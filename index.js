const express = require("express");
const app = express();
const http = require("http").createServer(app);
const path = require("path");
const port = process.env.PORT || 9000;

const io = require("socket.io")(http, {
  pingInterval: 25000,
  pingTimeout: 60000,
});

// Room.js functions
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

// Production mode
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "baucua-client/build")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "baucua-client/build", "index.html"));
  });
}

// Build/Development mode
app.get("*", (req, res) => {
  // Vô hiệu hóa favicon.ico và các vấn đề liên quan đến PUBLIC_URL
  if (req.url.includes("favicon.ico")) {
    return res.status(204).send(); // Không gửi nội dung nào
  }
  res.sendFile(path.join(__dirname, "baucua-client/public/index.html"));
});

// SOCKET HANDLER
io.on("connection", (socket) => {
  console.log(socket.id + " has just connected");

  // SOCKET HANDLER - HOSTING A ROOM
  socket.on("host", ({ name, room }, callback) => {
    socket.roomname = room;

    // Error checking to see if room already exists
    if (findRoom(room).length > 0) {
      return callback("Unable to create the room.");
    }

    // Create a new room
    createRoom(socket.id, room);
    callback();

    // Check that room was successfully created before joining
    const status = checkRoom(room);
    if (status) {
      return callback(status);
    }

    // Add socket to the room
    const user = joinRoom(socket.id, name, room);
    if (user === null) return;
    socket.join(user.room);
    callback();
  });

  // SOCKET HANDLER - JOINING A ROOM
  socket.on("join", ({ name, room }, callback) => {
    socket.roomname = room;

    // Add socket to specified room
    const user = joinRoom(socket.id, name, room);
    if (user === null) return;
    socket.join(user.room);
    callback();
  });

  // SOCKET HANDLER - ERROR CHECKING ROOM CODE
  socket.on("check", ({ room }, callback) => {
    const status = checkRoom(room);
    if (status) {
      return callback(status);
    }
    callback();
  });

  // SOCKET HANDLER - SETUP ROOM ON HOST OR JOIN LOBBY
  socket.on("roomsetup", () => {
    const r = findRoom(socket.roomname)[0];
    if (r === undefined) return;

    io.to(socket.roomname).emit("roomdata", {
      room: socket.roomname,
      host: r.host,
      settings: r.settings,
    });

    io.to(socket.roomname).emit("players", { players: r.players });
  });

  // SOCKET HANDLER - SETTINGS
  socket.on("timerchange", ({ timer }) => {
    const option = changeRoomSettings(socket.roomname, "time", timer);
    if (option === null) return;
    io.to(socket.roomname).emit("timeropt", { timer: option });
  });
  socket.on("roundschange", ({ rounds }) => {
    const option = changeRoomSettings(socket.roomname, "rounds", rounds);
    if (option === null) return;
    io.to(socket.roomname).emit("roundsopt", { rounds: option });
  });
  socket.on("balancechange", ({ balance }) => {
    const option = changeRoomSettings(socket.roomname, "balance", balance);
    if (option === null) return;
    io.to(socket.roomname).emit("balanceopt", { balance: option });
  });

  // SOCKET HANDLER - STARTING OR RESTARTING A GAME
  socket.on("startgame", ({ balance }) => {
    const gamestate = setInitialGamestate(socket.roomname, balance);
    if (gamestate === null) return;
    io.to(socket.roomname).emit("gamestart", { gamestate });
  });
  socket.on("playagain", () => {
    const gamestate = resetGamestate(socket.roomname);
    if (gamestate === null) return;
    io.to(socket.roomname).emit("gamerestart", { gamestate });
  });

  // SOCKET HANDLER - DISCONNECT
  socket.on("disconnect", () => {
    console.log(socket.id + " has left");

    // Remove the player from the room
    const player = removePlayer(socket.id, socket.roomname);
    if (player === null) return;

    // Update the room
    const r = findRoom(player.room)[0];
    if (r === undefined) return;

    // New player list
    io.to(player.room).emit("players", {
      players: r.players,
    });

    // New host if last host has left
    const new_host = r.players[0]?.id || null;
    r.host = new_host;
    io.to(player.room).emit("newhost", { host: r.host });

    // New gamestate
    if (r.active) {
      const gamestate = r;
      io.to(player.room).emit("newgamestate", { gamestate });
    }
  });
});

// Server listener
http.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
