// Global data structures
const rooms = [];
const chatrooms = [];

// Functions that handle room events
// Create and add a new room to the server
const createRoom = (id, room) => {
  // Comment nếu không cần sử dụng colors
  const colors = [
    "#c04e48", //red
    "#4a7eac", //blue
    "#d3c56e", //yellow
    "#4e9e58", //green
    "#ca7f3e", //orange
    "#7fc7b1", //teal
    "#ca709d", //pink
    "#903c9c", //purple
  ];

  const r = {
    roomId: room,
    active: false,
    host: id,
    players: [],
    bets: [],
    dice: [],
    colors: colors, // Bỏ nếu không cần
    settings: { time: 30, rounds: 5, balance: 10 },
    round: 1,
    timer: 30,
  };

  const c = {
    roomId: room,
    messages: [],
  };

  rooms.push(r);
  chatrooms.push(c);
};

// Add a player to a room
const joinRoom = (id, name, room) => {
  const gameroom = findRoom(room)[0];
  if (!gameroom) return null;

  const color = gameroom.colors.shift() || "#000000"; // Mặc định màu đen nếu không còn màu

  const user = {
    id,
    name,
    color,
    room,
    total: 0,
    net: 0,
    rank: 1,
    bankrupt: false,
    ready: false,
  };

  gameroom.players.push(user);

  return user;
};

const checkRoom = (room) => {
  const r = findRoom(room);

  if (r.length === 0) {
    return "The room you tried to enter does not exist.";
  } else if (r.length > 0 && r[0].players.length >= 8) {
    return "The room you tried to enter is already full.";
  } else if (r[0].active) {
    return "The room you tried to enter has already started.";
  }

  return false;
};

const changeRoomSettings = (room, setting, value) => {
  const gameroom = findRoom(room)[0];
  if (!gameroom) return null;

  switch (setting) {
    case "time":
      gameroom.settings.time = value;
      gameroom.timer = value;
      break;
    case "rounds":
      gameroom.settings.rounds = value;
      break;
    case "balance":
      gameroom.settings.balance = value;
      break;
    default:
      break;
  }

  return value;
};

const findRoom = (room) => rooms.filter((r) => r.roomId === room);

// Functions that handle gamestate
// Set all player balances and gameroom to active
const setInitialGamestate = (room, balance) => {
  const gameroom = findRoom(room)[0];
  if (!gameroom) return null;

  gameroom.active = true;

  gameroom.players.forEach((player) => {
    player.total = balance;
  });

  return gameroom;
};

// Clear the gamestate and deactivate gameroom
const resetGamestate = (room) => {
  const gameroom = findRoom(room)[0];
  if (!gameroom) return null;

  gameroom.active = false;
  gameroom.bets = [];
  gameroom.dice = [];
  gameroom.round = 1;

  gameroom.players.forEach((player) => {
    player.total = 0;
    player.net = 0;
    player.rank = 1;
    player.bankrupt = false;
    player.ready = false;
  });

  return gameroom;
};

// Go to next round
const nextRound = (room) => {
  const gameroom = findRoom(room)[0];
  if (!gameroom) return null;

  gameroom.round += 1;
  if (gameroom.round > gameroom.settings.rounds) {
    return -1;
  }
  return gameroom.round;
};

// Remove a player from the room
const removePlayer = (id, room) => {
  const gameroom = findRoom(room)[0];
  if (!gameroom) return null;

  const playerIndex = gameroom.players.findIndex((p) => p.id === id);
  if (playerIndex === -1) return null;

  const player = gameroom.players.splice(playerIndex, 1)[0];

  // Trả lại màu vào danh sách (nếu dùng)
  if (player.color) gameroom.colors.push(player.color);

  // Nếu phòng trống, xóa phòng
  if (gameroom.players.length === 0) {
    const roomIndex = rooms.findIndex((r) => r.roomId === room);
    if (roomIndex !== -1) rooms.splice(roomIndex, 1);

    const chatIndex = chatrooms.findIndex((c) => c.roomId === room);
    if (chatIndex !== -1) chatrooms.splice(chatIndex, 1);
  }

  return player;
};

// Chat handling
const addMessage = (id, room, name, message) => {
  const chatroom = chatrooms.find((c) => c.roomId === room);
  if (!chatroom) return [];

  const gameroom = findRoom(room)[0];
  if (!gameroom) return [];

  const player = gameroom.players.find((p) => p.id === id);
  if (!player) return [];

  const messageObject = {
    name,
    color: player.color,
    message,
  };

  chatroom.messages.push(messageObject);
  return chatroom.messages;
};

// Other utility functions (unchanged)


// Functions that handle the timer
// Reset the timer
const resetTime = (room) => {
  const gameroom = findRoom(room)[0];
  if (gameroom === undefined) return null;

  gameroom.timer = gameroom.settings.time;

  return gameroom.timer;
};

// Count down the timer by 1s
const countdown = (room) => {
  const gameroom = findRoom(room)[0];
  if (gameroom === undefined || allReady(gameroom)) {
    return null;
  }

  gameroom.timer -= 1;

  return gameroom.timer;
};

// Helper functions
// Sort and return rankings based off the total scores
const setRankingsByTotal = (gameroom) => {
  const players = gameroom.players;
  const sorted_players = [...players].sort((a, b) => {
    return b.total - a.total;
  });

  // Set rankings
  sorted_players[0].rank = 1;
  for (let i = 1; i < sorted_players.length; i++) {
    if (sorted_players[i].total === sorted_players[i - 1].total) {
      sorted_players[i].rank = sorted_players[i - 1].rank;
    } else {
      sorted_players[i].rank = sorted_players[i - 1].rank + 1;
    }
  }

  return sorted_players;
};

// Sort and return rankings based on net scores
const setRankingsByNet = (gameroom) => {
  const players = gameroom.players;
  const sorted_players = [...players].sort((a, b) => {
    return b.net - a.net;
  });

  return sorted_players;
};

// Check if all players are ready
const allReady = (gameroom) => {
  const players = gameroom.players;

  for (let i = 0; i < players.length; i++) {
    if (players[i].ready === false) {
      return false;
    }
  }

  return true;
};

// Module Exports
module.exports = {
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
};
