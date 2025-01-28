const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 9000;

// Sử dụng middleware
app.use(cors());
app.use(express.json());

// Cấu hình Socket.io
const io = require("socket.io")(server, {
  pingInterval: 25000,
  pingTimeout: 60000,
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  allowEIO3: true,
});

// Import các hàm xử lý phòng
const {
  createRoom,
  joinRoom,
  checkRoom,
  findRoom,
  removePlayer
} = require("./room");

// Static file declaration
app.use(express.static(path.join(__dirname, "baucua-client/build")));

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "baucua-client/build")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "baucua-client/build/index.html"));
  });
} else {
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "baucua-client/public/index.html"));
  });
}

// SOCKET HANDLER
io.on("connection", (socket) => {
  console.log(`✅ New connection: ${socket.id}`);

  // Kiểm tra phòng tồn tại
  socket.on("check", ({ room }, callback) => {
    const status = checkRoom(room);
    console.log(`🔍 Checking room ${room} - Status: ${status}`);
    callback(status);
  });

  // Tạo phòng
  socket.on("host", ({ name, room }, callback) => {
    console.log(`🛠 Creating room: ${room}`);

    if (findRoom(room).length > 0) {
      console.log(`❌ Room ${room} already exists.`);
      callback("Room already exists.");
      return;
    }

    createRoom(socket.id, room);
    const status = checkRoom(room);

    if (status) {
      console.log(`❌ Error creating room ${room}: ${status}`);
      callback(status);
      return;
    }

    const user = joinRoom(socket.id, name, room);
    if (!user) {
      console.log(`❌ Error joining room ${room}`);
      callback("Error joining room.");
      return;
    }

    socket.join(user.room);
    console.log(`✅ Room ${room} created by ${socket.id}`);
    callback();
  });

  // Tham gia phòng
  socket.on("join", ({ name, room }, callback) => {
    console.log(`🔄 ${name} is attempting to join room: ${room}`);

    const status = checkRoom(room);
    if (status) {
      console.log(`❌ Error joining room ${room}: ${status}`);
      callback(status);
      return;
    }

    const user = joinRoom(socket.id, name, room);
    if (!user) {
      console.log(`❌ Error joining room ${room}`);
      callback("Error joining room.");
      return;
    }

    socket.join(user.room);
    console.log(`✅ ${name} joined room: ${room}`);
    callback();
  });

  // Xử lý khi người chơi rời phòng
  socket.on("disconnect", () => {
    console.log(`❌ Socket disconnected: ${socket.id}`);
    const player = removePlayer(socket.id);
    if (!player) return;

    const room = findRoom(player.room)[0];
    if (!room) return;

    io.to(player.room).emit("players", { players: room.players });

    if (room.players.length > 0) {
      room.host = room.players[0].id;
      io.to(player.room).emit("newhost", { host: room.host });
    }
  });
});

// Khởi động server
server.listen(port, "0.0.0.0", () => {
  console.log(`🚀 Server is running on port ${port}`);
});
