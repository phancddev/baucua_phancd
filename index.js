const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 9000;

// Middleware
app.use(cors());
app.use(express.json());

// Socket.io setup
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

// Import các hàm xử lý room
const {
  createRoom,
  joinRoom,
  checkRoom,
  changeRoomSettings,
  findRoom,
  setInitialGamestate,
  resetGamestate,
  nextRound,
  addBet,
  removeBet,
  clearBets,
  clearNets,
  calculateBets,
  calculateNets,
  checkBankrupt,
  rollDice,
  setReady,
  allPlayersReady,
  removePlayer,
  addMessage,
  resetTime,
  countdown,
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
  console.log(`🔗 Client connected: ${socket.id}`);

  // 🏠 TẠO PHÒNG VÀ ĐẶT HOST
  socket.on("host", ({ name, room }, callback) => {
    socket.roomname = room;

    if (findRoom(room).length > 0) {
      console.log(`⚠️ Room ${room} already exists.`);
      callback("Room already exists.");
      return;
    }

    createRoom(socket.id, room);
    const user = joinRoom(socket.id, name, room);

    if (!user) {
      console.log(`❌ Error joining room ${room}`);
      callback("Error joining room.");
      return;
    }

    socket.join(user.room);
    
    // ✅ Đảm bảo người đầu tiên là host
    const roomData = findRoom(room)[0];
    if (roomData) {
      roomData.host = socket.id;
      io.to(socket.roomname).emit("newhost", { host: roomData.host });
    }

    console.log(`✅ Room created: ${room} by ${socket.id}`);
    callback();
  });

  // 🔗 NGƯỜI CHƠI JOIN PHÒNG
  socket.on("join", ({ name, room }, callback) => {
    socket.roomname = room;

    const status = checkRoom(room);
    if (status) {
      console.log(`⚠️ Error joining room ${room}: ${status}`);
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
    
    // ✅ Không thay đổi host nếu đã có host
    const roomData = findRoom(room)[0];
    if (roomData && !roomData.host) {
      roomData.host = socket.id;
      io.to(socket.roomname).emit("newhost", { host: roomData.host });
    }

    console.log(`🔗 ${name} joined room: ${room}`);
    callback();
  });

  // 🚀 CẬP NHẬT THÔNG TIN PHÒNG
  socket.on("roomsetup", () => {
    const room = findRoom(socket.roomname)[0];
    if (!room) return;

    io.to(socket.roomname).emit("roomdata", {
      room: socket.roomname,
      host: room.host,
      settings: room.settings,
    });

    io.to(socket.roomname).emit("players", { players: room.players });
  });

  // 🎮 BẮT ĐẦU GAME
  socket.on("startgame", ({ balance }) => {
    const gamestate = setInitialGamestate(socket.roomname, balance);
    if (!gamestate) return;

    io.to(socket.roomname).emit("gamestart", { gamestate });
  });

  // 🔄 CHƠI LẠI
  socket.on("playagain", () => {
    const gamestate = resetGamestate(socket.roomname);
    if (!gamestate) return;

    io.to(socket.roomname).emit("gamerestart", { gamestate });
  });

  // 🎲 XỬ LÝ KHI HOST RỜI PHÒNG
  socket.on("disconnect", () => {
    console.log(`❌ Client disconnected: ${socket.id}`);

    const player = removePlayer(socket.id, socket.roomname);
    if (!player) return;

    const room = findRoom(player.room)[0];
    if (!room) return;

    io.to(player.room).emit("players", { players: room.players });

    if (room.players.length > 0) {
      room.host = room.players[0].id;
      io.to(player.room).emit("newhost", { host: room.host });
      console.log(`🛠 New host: ${room.host} for room: ${player.room}`);
    } else {
      console.log(`🚪 Room ${player.room} is now empty.`);
    }
  });
});

// 🔥 KHỞI CHẠY SERVER
server.listen(port, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${port}`);
});
