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
  console.log(`Socket connected: ${socket.id}`);

  // Handle host room
  socket.on("host", ({ name, room }, callback) => {
    socket.roomname = room;

    if (findRoom(room).length > 0) {
      console.log(`Room ${room} already exists.`);
      callback("Room already exists.");
      return;
    }

    createRoom(socket.id, room);

    const status = checkRoom(room);
    if (status) {
      console.log(`Error creating room ${room}: ${status}`);
      callback(status);
      return;
    }

    const user = joinRoom(socket.id, name, room);
    if (!user) {
      console.log(`Error joining room ${room}`);
      callback("Error joining room.");
      return;
    }

    socket.join(user.room);
    console.log(`Room created: ${room} by ${socket.id}`);
    callback();
  });

  // Handle join room
  socket.on("join", ({ name, room }, callback) => {
    socket.roomname = room;

    const status = checkRoom(room);
    if (status) {
      console.log(`Error joining room ${room}: ${status}`);
      callback(status);
      return;
    }

    const user = joinRoom(socket.id, name, room);
    if (!user) {
      console.log(`Error joining room ${room}`);
      callback("Error joining room.");
      return;
    }

    socket.join(user.room);
    console.log(`${name} joined room: ${room}`);
    callback();
  });

  // Handle room setup
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

  // Handle game settings changes
  socket.on("timerchange", ({ timer }) => {
    const option = changeRoomSettings(socket.roomname, "time", timer);
    if (!option) return;

    io.to(socket.roomname).emit("timeropt", { timer: option });
  });

  socket.on("roundschange", ({ rounds }) => {
    const option = changeRoomSettings(socket.roomname, "rounds", rounds);
    if (!option) return;

    io.to(socket.roomname).emit("roundsopt", { rounds: option });
  });

  socket.on("balancechange", ({ balance }) => {
    const option = changeRoomSettings(socket.roomname, "balance", balance);
    if (!option) return;

    io.to(socket.roomname).emit("balanceopt", { balance: option });
  });

  // Handle game start
  socket.on("startgame", ({ balance }) => {
    const gamestate = setInitialGamestate(socket.roomname, balance);
    if (!gamestate) return;

    io.to(socket.roomname).emit("gamestart", { gamestate });
  });

  socket.on("playagain", () => {
    const gamestate = resetGamestate(socket.roomname);
    if (!gamestate) return;

    io.to(socket.roomname).emit("gamerestart", { gamestate });
  });

  // Handle round flow
  socket.on("roundstart", () => {
    let current_time = resetTime(socket.roomname);
    if (!current_time) return;

    io.to(socket.roomname).emit("timer", { current_time });
    io.to(socket.roomname).emit("cleardice");
    io.to(socket.roomname).emit("showround");

    setTimeout(() => {
      io.to(socket.roomname).emit("hideround");

      const interval = setInterval(() => {
        current_time = countdown(socket.roomname);

        if (!current_time) {
          clearInterval(interval);
        } else if (current_time >= 0) {
          io.to(socket.roomname).emit("timer", { current_time });
        } else {
          clearInterval(interval);
          handleRoundEnd(socket.roomname);
        }
      }, 1000);
    }, 3000);
  });

  const handleRoundEnd = (room) => {
    io.to(room).emit("showtimesup");

    setTimeout(() => {
      io.to(room).emit("hidetimesup");
      const gamestate = rollDice(room);
      if (!gamestate) return;

      io.to(room).emit("diceroll", {
        die1: gamestate.dice[0],
        die2: gamestate.dice[1],
        die3: gamestate.dice[2],
      });

      setTimeout(() => {
        const results = calculateNets(room);
        io.to(room).emit("showresults", { results });

        setTimeout(() => {
          io.to(room).emit("hideresults");
          const updatedGamestate = clearBets(room);
          if (!updatedGamestate) return;

          io.to(room).emit("newgamestate", { gamestate: updatedGamestate });
        }, 5000);
      }, 5500);
    }, 3000);
  };

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
    const player = removePlayer(socket.id, socket.roomname);
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

// Start server
server.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on port ${port}`);
});
