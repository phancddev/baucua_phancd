const express = require("express");
const app = express();
const http = require("http").createServer(app);
const path = require("path");
const cors = require('cors');
const port = process.env.PORT || 9000;

// Sử dụng middleware
app.use(cors());
app.use(express.json());

const io = require("socket.io")(http, {
  pingInterval: 25000,
  pingTimeout: 60000,
  cors: {
    origin: "*",  // Cho phép tất cả origins trong development
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// Import room functions
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
    res.sendFile(path.join(__dirname, "baucua-client/build/index.html"));
  });
} else {
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

    // Error checking to see if room already exists
    if (findRoom(room).length > 0) {
      callback("Unable to create the room.");
      return;
    }

    // Create a new room
    createRoom(socket.id, room);

    // Check that room was successfully created before joining
    const status = checkRoom(room);
    if (status) {
      callback(status);
      return;
    }

    // Add socket to the room
    const user = joinRoom(socket.id, name, room);
    if (user === null) {
      callback("Error joining room");
      return;
    }
    
    socket.join(user.room);
    callback();
  });

  // SOCKET HANDLER - JOINING A ROOM
  socket.on("join", ({ name, room }, callback) => {
    socket.roomname = room;

    // Check if room exists
    const status = checkRoom(room);
    if (status) {
      callback(status);
      return;
    }

    // Add socket to specified room
    const user = joinRoom(socket.id, name, room);
    if (user === null) {
      callback("Error joining room");
      return;
    }
    
    socket.join(user.room);
    callback();
  });

  // SOCKET HANDLER - ROOM SETUP
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

  // SOCKET HANDLER - GAME SETTINGS
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

  // SOCKET HANDLER - GAME STATES
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

  // SOCKET HANDLER - ROUND FLOW
  socket.on("roundstart", () => {
    let current_time = resetTime(socket.roomname);
    if (current_time === null) return;

    io.to(socket.roomname).emit("timer", { current_time });
    io.to(socket.roomname).emit("cleardice");
    io.to(socket.roomname).emit("showround");

    setTimeout(() => {
      io.to(socket.roomname).emit("hideround");

      const interval = setInterval(() => {
        current_time = countdown(socket.roomname);
        
        if (current_time === null) {
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

  // Helper function for round end logic
  const handleRoundEnd = (room) => {
    io.to(room).emit("showtimesup");

    setTimeout(() => {
      io.to(room).emit("hidetimesup");
      let gamestate = rollDice(room);
      if (gamestate === null) return;

      io.to(room).emit("diceroll", {
        die1: gamestate.dice[0],
        die2: gamestate.dice[1],
        die3: gamestate.dice[2],
      });

      setTimeout(() => {
        let results = calculateNets(room);
        io.to(room).emit("showresults", { results });

        setTimeout(() => {
          io.to(room).emit("hideresults");
          results = calculateBets(room);
          gamestate = clearBets(room);
          if (gamestate === null) return;
          gamestate = clearNets(room);
          if (gamestate === null) return;

          io.to(room).emit("newgamestate", { gamestate });

          let round = nextRound(room);
          let bankrupt = checkBankrupt(room);
          if (bankrupt === null) return;

          if (round === -1 || bankrupt) {
            io.to(room).emit("gameover", { results });
          } else {
            io.to(room).emit("nextround", { round });
          }
        }, 5000);
      }, 5500);
    }, 3000);
  };

  // SOCKET HANDLER - BETTING
  socket.on("bet", ({ id, amount, animal }) => {
    const gamestate = addBet(socket.roomname, id, amount, animal);
    if (gamestate === null) return;
    io.to(socket.roomname).emit("newgamestate", { gamestate });
  });

  socket.on("unbet", ({ id, amount, animal }) => {
    const gamestate = removeBet(socket.roomname, id, amount, animal);
    if (gamestate === null) return;
    io.to(socket.roomname).emit("newgamestate", { gamestate });
  });

  // SOCKET HANDLER - CHAT
  socket.on("sendmessage", ({ id, name, message }) => {
    const chatbox = addMessage(id, socket.roomname, name, message);
    if (chatbox === null) return;
    io.to(socket.roomname).emit("chatbox", { chatbox });
  });

  // SOCKET HANDLER - DISCONNECT
  socket.on("disconnect", () => {
    console.log(socket.id + " has disconnected");

    const player = removePlayer(socket.id, socket.roomname);
    if (player === null) return;

    const r = findRoom(player.room)[0];
    if (r === undefined) return;

    io.to(player.room).emit("players", { players: r.players });

    if (r.players.length > 0) {
      const new_host = r.players[0].id;
      r.host = new_host;
      io.to(player.room).emit("newhost", { host: r.host });

      if (r.active) {
        io.to(player.room).emit("newgamestate", { gamestate: r });
      }
    }
  });
});

// Server listener
http.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on port ${port}`);
});