const express = require("express");
const cors = require("cors"); // Thêm CORS middleware
const app = express();
const http = require("http").createServer(app);
const path = require("path");
const port = process.env.PORT || 9000;

const io = require("socket.io")(http, {
  pingInterval: 25000,
  pingTimeout: 60000,
});

// Import các hàm trong room.js
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

// Middleware: Bật CORS cho toàn bộ API
app.use(
  cors({
    origin: "*", // Cho phép mọi domain
    methods: ["GET", "POST", "PUT", "DELETE"], // Cho phép tất cả HTTP methods
    allowedHeaders: ["Content-Type", "Authorization"], // Chỉ định các header được phép
  })
);

// Middleware: Tự động parse JSON payload từ client
app.use(express.json());

// Middleware: Bỏ qua favicon.ico
app.get("/favicon.ico", (req, res) => res.status(204));

// Serve static files trong chế độ production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "baucua-client/build")));
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "baucua-client/build", "index.html"));
  });
} else {
  // Build/Development mode
  app.use(express.static(path.join(__dirname, "baucua-client/public")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "baucua-client/public/index.html"));
  });
}

// SOCKET HANDLER
io.on("connection", (socket) => {
  console.log(socket.id + " has just connected");

  // SOCKET HANDLER - HOSTING A ROOM
  socket.on("host", ({ name, room }, callback) => {
    socket.roomname = room;

    if (findRoom(room).length > 0) {
      return callback("Unable to create the room.");
    }

    createRoom(socket.id, room);
    const status = checkRoom(room);
    if (status) {
      return callback(status);
    }

    const user = joinRoom(socket.id, name, room);
    if (user === null) return null;
    socket.join(user.room);
    callback();
  });

  // SOCKET HANDLER - JOINING A ROOM
  socket.on("join", ({ name, room }, callback) => {
    socket.roomname = room;
    const user = joinRoom(socket.id, name, room);
    if (user === null) return null;
    socket.join(user.room);
    callback();
  });

  // SOCKET HANDLER - ROOM SETUP
  socket.on("roomsetup", () => {
    const r = findRoom(socket.roomname)[0];
    if (!r) return null;

    io.to(socket.roomname).emit("roomdata", {
      room: socket.roomname,
      host: r.host,
      settings: r.settings,
    });

    io.to(socket.roomname).emit("players", { players: r.players });
  });

  // SOCKET HANDLER - GAME FLOW
  socket.on("startgame", ({ balance }) => {
    const gamestate = setInitialGamestate(socket.roomname, balance);
    if (!gamestate) return null;
    io.to(socket.roomname).emit("gamestart", { gamestate });
  });

  socket.on("playagain", () => {
    const gamestate = resetGamestate(socket.roomname);
    if (!gamestate) return null;
    io.to(socket.roomname).emit("gamerestart", { gamestate });
  });

  socket.on("roundstart", () => {
    let current_time = resetTime(socket.roomname);
    if (!current_time) return null;

    io.to(socket.roomname).emit("timer", { current_time });
    io.to(socket.roomname).emit("cleardice");
    io.to(socket.roomname).emit("showround");

    setTimeout(() => {
      io.to(socket.roomname).emit("hideround");

      let interval = setInterval(() => {
        current_time = countdown(socket.roomname);
        if (!current_time) {
          clearInterval(interval);
        } else if (current_time >= 0) {
          io.to(socket.roomname).emit("timer", { current_time });
        } else {
          clearInterval(interval);
          io.to(socket.roomname).emit("showtimesup");

          setTimeout(() => {
            io.to(socket.roomname).emit("hidetimesup");
            const gamestate = rollDice(socket.roomname);
            if (!gamestate) return null;

            io.to(socket.roomname).emit("diceroll", {
              die1: gamestate.dice[0],
              die2: gamestate.dice[1],
              die3: gamestate.dice[2],
            });

            setTimeout(() => {
              let results = calculateNets(socket.roomname);
              io.to(socket.roomname).emit("showresults", { results });

              setTimeout(() => {
                io.to(socket.roomname).emit("hideresults");
                results = calculateBets(socket.roomname);
                clearBets(socket.roomname);
                clearNets(socket.roomname);

                let round = nextRound(socket.roomname);
                let bankrupt = checkBankrupt(socket.roomname);

                if (round === -1 || bankrupt) {
                  io.to(socket.roomname).emit("gameover", { results });
                } else {
                  io.to(socket.roomname).emit("nextround", { round });
                }
              }, 5000);
            }, 5500);
          }, 3000);
        }
      }, 1000);
    }, 3000);
  });

  // SOCKET HANDLER - DISCONNECT
  socket.on("disconnect", () => {
    console.log(socket.id + " disconnected");
    const player = removePlayer(socket.id, socket.roomname);
    if (!player) return null;

    const r = findRoom(player.room)[0];
    if (!r) return null;

    io.to(player.room).emit("players", { players: r.players });

    const new_host = r.players[0]?.id;
    r.host = new_host;
    io.to(player.room).emit("newhost", { host: new_host });

    if (r.active) {
      io.to(player.room).emit("newgamestate", { gamestate: r });
    }
  });
});

// Server listener
http.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
