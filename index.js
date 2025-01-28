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

// Import game functions
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

// Static files
app.use(express.static(path.join(__dirname, "baucua-client/build")));

// Routes
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

// Socket handler
io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Check room existence
  socket.on("check", ({ room }, callback) => {
    console.log(`Checking room ${room}`);
    const status = checkRoom(room);
    console.log(`Room ${room} check status:`, status);
    callback(status);
  });

  // Host room
  socket.on("host", ({ name, room }, callback) => {
    console.log(`Host attempt - Name: ${name}, Room: ${room}`);
    socket.roomname = room;

    if (findRoom(room).length > 0) {
      console.log(`Room ${room} already exists`);
      callback("Room already exists.");
      return;
    }

    createRoom(socket.id, room);
    console.log(`Room ${room} created`);

    const user = joinRoom(socket.id, name, room);
    if (!user) {
      console.log(`Failed to join room ${room}`);
      callback("Error joining room.");
      return;
    }

    socket.join(user.room);

    // Emit room data
    const roomData = findRoom(room)[0];
    io.to(room).emit("roomdata", {
      room: room,
      host: roomData.host,
      settings: roomData.settings
    });
    io.to(room).emit("players", { players: roomData.players });

    console.log(`Room created and joined: ${room} by ${name}`);
    callback();
  });

  // Join room
  socket.on("join", ({ name, room }, callback) => {
    console.log(`Join attempt - Name: ${name}, Room: ${room}`);
    socket.roomname = room;

    const roomData = findRoom(room)[0];
    if (!roomData) {
      console.log(`Room ${room} not found`);
      callback("Room not found.");
      return;
    }

    if (roomData.players.length >= 40) {
      console.log(`Room ${room} is full`);
      callback("Room is full.");
      return;
    }

    if (roomData.active) {
      console.log(`Room ${room} game already started`);
      callback("Game already started.");
      return;
    }

    const user = joinRoom(socket.id, name, room);
    if (!user) {
      console.log(`Failed to join room ${room}`);
      callback("Error joining room.");
      return;
    }

    socket.join(user.room);

    // Emit updated room data
    io.to(room).emit("roomdata", {
      room: room,
      host: roomData.host,
      settings: roomData.settings
    });
    io.to(room).emit("players", { players: roomData.players });

    console.log(`${name} joined room ${room}`);
    callback();
  });

  // Room setup and game settings handlers remain the same
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

  // Game start handlers
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
  // Round handling
socket.on("roundstart", () => {
  let current_time = resetTime(socket.roomname);
  if (!current_time) return;

  io.to(socket.roomname).emit("timer", { current_time });
  io.to(socket.roomname).emit("cleardice");
  io.to(socket.roomname).emit("showround");

  setTimeout(() => {
    io.to(socket.roomname).emit("hideround");

    const interval = setInterval(() => {
      const room = findRoom(socket.roomname)[0];
      if (!room) {
        clearInterval(interval);
        return;
      }

      // Kiểm tra nếu tất cả người chơi đã bet hoặc bankrupt
      const allPlayersPlacedBet = room.players.every(player => {
        const hasBet = room.bets.some(bet => bet.id === player.id);
        return hasBet || player.bankrupt || player.ready;
      });

      current_time = countdown(socket.roomname);

      if (allPlayersPlacedBet) {
        clearInterval(interval);
        io.to(room).emit("showallbetsin");
        setTimeout(() => {
          io.to(room).emit("hideallbetsin");
          handleRoundEnd(socket.roomname);
        }, 2000);
      } else if (!current_time || current_time < 0) {
        // Hết thời gian
        clearInterval(interval);
        io.to(room).emit("showtimesup");
        setTimeout(() => {
          io.to(room).emit("hidetimesup");
          handleRoundEnd(socket.roomname);
        }, 2000);
      } else {
        io.to(socket.roomname).emit("timer", { current_time });
      }
    }, 1000);
  }, 3000);
});

const handleRoundEnd = (room) => {
  const gameRoom = findRoom(room)[0];
  if (!gameRoom) return;

  // Quay xúc xắc
  const gamestate = rollDice(room);
  if (!gamestate) return;

  // Emit kết quả xúc xắc
  io.to(room).emit("diceroll", {
    die1: gamestate.dice[0],
    die2: gamestate.dice[1],
    die3: gamestate.dice[2],
  });

  // Tính toán kết quả
  setTimeout(() => {
    const results = calculateNets(room);
    io.to(room).emit("showresults", { results });

    setTimeout(() => {
      io.to(room).emit("hideresults");
      const finalResults = calculateBets(room);
      
      // Clear bets và nets
      let updatedGamestate = clearBets(room);
      if (!updatedGamestate) return;
      
      updatedGamestate = clearNets(room);
      if (!updatedGamestate) return;

      // Reset trạng thái ready
      updatedGamestate.players.forEach(player => {
        player.ready = false;
      });

      io.to(room).emit("newgamestate", { gamestate: updatedGamestate });

      // Kiểm tra vòng tiếp theo
      const nextRoundNum = nextRound(room);
      const bankrupt = checkBankrupt(room);
      if (bankrupt === null) return;

      if (nextRoundNum === -1 || bankrupt) {
        io.to(room).emit("gameover", { results: finalResults });
      } else {
        io.to(room).emit("nextround", { round: nextRoundNum });
      }
    }, 5000);
  }, 5500);
};
  // Betting handlers
  socket.on("bet", ({ id, amount, animal }) => {
    const gamestate = addBet(socket.roomname, id, amount, animal);
    if (!gamestate) return;
    io.to(socket.roomname).emit("newgamestate", { gamestate });
  });

  socket.on("unbet", ({ id, amount, animal }) => {
    const gamestate = removeBet(socket.roomname, id, amount, animal);
    if (!gamestate) return;
    io.to(socket.roomname).emit("newgamestate", { gamestate });
  });

  // Handle player ready (when they click Bet button)
  socket.on("readyplayer", () => {
    const gamestate = setReady(socket.roomname, socket.id);
    if (!gamestate) return;
    io.to(socket.roomname).emit("newgamestate", { gamestate });
  });

  // Chat handler
  socket.on("sendmessage", ({ id, name, message }) => {
    const chatbox = addMessage(id, socket.roomname, name, message);
    if (!chatbox) return;
    io.to(socket.roomname).emit("chatbox", { chatbox });
  });

  // Disconnect handler
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

      if (room.active) {
        io.to(player.room).emit("newgamestate", { gamestate: room });
      }
    }
  });
});

// Start server
server.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on port ${port}`);
});