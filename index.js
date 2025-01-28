const express = require("express");
const app = express();
const http = require("http").createServer(app);
const path = require("path");
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const port = process.env.PORT || 9000;

// Setup logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Apply rate limiting to all routes
app.use(limiter);

const io = require("socket.io")(http, {
  pingInterval: 25000,
  pingTimeout: 60000,
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Import game logic functions
const GameManager = require("./gameManager");
const { validateRoomInput, validateGameSettings } = require("./validators");
const { ErrorTypes, GameError } = require("./errors");

// Initialize game manager
const gameManager = new GameManager();

// Middleware for error handling
const socketErrorHandler = (socket, callback) => {
  try {
    callback();
  } catch (error) {
    logger.error('Socket error:', error);
    socket.emit('error', { message: error.message });
  }
};

// Static file serving
app.use(express.static(path.join(__dirname, "baucua-client/build")));

// Route handling based on environment
if (process.env.NODE_ENV === "production") {
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "baucua-client/build/index.html"));
  });
} else {
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "baucua-client/public/index.html"));
  });
}

// Socket connection handler
io.on("connection", (socket) => {
  logger.info(`New connection: ${socket.id}`);
  
  // Store timeouts and intervals for cleanup
  const timeouts = new Set();
  const intervals = new Set();

  // Utility function to safely set timeout
  const safeSetTimeout = (callback, delay) => {
    const timeout = setTimeout(callback, delay);
    timeouts.add(timeout);
    return timeout;
  };

  // Utility function to safely set interval
  const safeSetInterval = (callback, delay) => {
    const interval = setInterval(callback, delay);
    intervals.add(interval);
    return interval;
  };

  // Clean up function
  const cleanup = () => {
    timeouts.forEach(clearTimeout);
    intervals.forEach(clearInterval);
    timeouts.clear();
    intervals.clear();
  };

  // Host room handler
  socket.on("host", async ({ name, room }, callback) => {
    socketErrorHandler(socket, async () => {
      // Validate input
      validateRoomInput({ name, room });

      // Create and join room
      const result = await gameManager.createAndJoinRoom(socket.id, name, room);
      
      socket.roomname = room;
      socket.join(room);
      
      io.to(room).emit('roomdata', result.roomData);
      io.to(room).emit('players', { players: result.players });
      
      callback();
    });
  });

  // Join room handler
  socket.on("join", async ({ name, room }, callback) => {
    socketErrorHandler(socket, async () => {
      validateRoomInput({ name, room });
      
      const result = await gameManager.joinRoom(socket.id, name, room);
      
      socket.roomname = room;
      socket.join(room);
      
      io.to(room).emit('players', { players: result.players });
      
      callback();
    });
  });

  // Game round handler
  socket.on("roundstart", () => {
    socketErrorHandler(socket, async () => {
      const room = socket.roomname;
      let gameState = await gameManager.startRound(room);
      
      // Reset timer and clear dice
      io.to(room).emit("timer", { current_time: gameState.time });
      io.to(room).emit("cleardice");
      io.to(room).emit("showround");

      // Round flow
      const roundFlow = async () => {
        try {
          // Show round start
          await new Promise(resolve => safeSetTimeout(resolve, 3000));
          io.to(room).emit("hideround");

          // Timer countdown
          const timerInterval = safeSetInterval(async () => {
            gameState = await gameManager.updateTime(room);
            
            if (gameState.time >= 0) {
              io.to(room).emit("timer", { current_time: gameState.time });
            } else {
              clearInterval(timerInterval);
              await handleRoundEnd(room);
            }
          }, 1000);
        } catch (error) {
          logger.error('Round flow error:', error);
          cleanup();
        }
      };

      roundFlow();
    });
  });

  // Handle round end logic
  const handleRoundEnd = async (room) => {
    try {
      io.to(room).emit("showtimesup");
      await new Promise(resolve => safeSetTimeout(resolve, 3000));
      
      // Roll dice and calculate results
      const rollResult = await gameManager.rollAndCalculate(room);
      
      io.to(room).emit("diceroll", rollResult.dice);
      await new Promise(resolve => safeSetTimeout(resolve, 5500));
      
      io.to(room).emit("showresults", { results: rollResult.results });
      await new Promise(resolve => safeSetTimeout(resolve, 5000));
      
      // Update game state and check game end
      const endResult = await gameManager.checkGameEnd(room);
      
      if (endResult.gameOver) {
        io.to(room).emit("gameover", { results: endResult.results });
      } else {
        io.to(room).emit("nextround", { round: endResult.nextRound });
      }
    } catch (error) {
      logger.error('Round end error:', error);
      cleanup();
    }
  };

  // Betting handlers
  socket.on("bet", ({ id, amount, animal }) => {
    socketErrorHandler(socket, async () => {
      const gameState = await gameManager.placeBet(socket.roomname, id, amount, animal);
      io.to(socket.roomname).emit("newgamestate", { gameState });
    });
  });

  // Chat handler
  socket.on("sendmessage", ({ id, name, message }) => {
    socketErrorHandler(socket, async () => {
      const chatbox = await gameManager.addMessage(id, socket.roomname, name, message);
      io.to(socket.roomname).emit("chatbox", { chatbox });
    });
  });

  // Disconnect handler
  socket.on("disconnect", async () => {
    try {
      cleanup();
      
      const result = await gameManager.handlePlayerDisconnect(socket.id, socket.roomname);
      
      if (result) {
        io.to(result.room).emit("players", { players: result.players });
        if (result.newHost) {
          io.to(result.room).emit("newhost", { host: result.newHost });
        }
        if (result.gameState) {
          io.to(result.room).emit("newgamestate", { gameState: result.gameState });
        }
      }
      
      logger.info(`Disconnected: ${socket.id}`);
    } catch (error) {
      logger.error('Disconnect error:', error);
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Server error:', err);
  res.status(500).send('Internal Server Error');
});

// Start server
http.listen(port, () => {
  logger.info(`Server running on port ${port}`);
});