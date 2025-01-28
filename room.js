const { EventEmitter } = require('events');
const { GameError } = require('./errors');

class GameRoom extends EventEmitter {
  static COLORS = [
    "#c04e48", //red
    "#4a7eac", //blue 
    "#d3c56e", //yellow
    "#4e9e58", //green
    "#ca7f3e", //orange
    "#7fc7b1", //teal
    "#ca709d", //pink
    "#903c9c", //purple
  ];

  static ANIMALS = ["deer", "gourd", "rooster", "fish", "crab", "shrimp"];

  static DEFAULT_SETTINGS = {
    time: 30,
    rounds: 5,
    balance: 10
  };

  constructor(roomId, hostId) {
    super();
    this.roomId = roomId;
    this.host = hostId;
    this.active = false;
    this.players = [];
    this.bets = [];
    this.dice = [];
    this.availableColors = [...GameRoom.COLORS];
    this.settings = { ...GameRoom.DEFAULT_SETTINGS };
    this.round = 1;
    this.timer = this.settings.time;
    this.messages = [];
  }

  // Player Management
  addPlayer(id, name) {
    this.validateMaxPlayers();
    this.validateGameNotStarted();

    const color = this.getNextColor();
    const player = {
      id,
      name,
      color,
      total: 0,
      net: 0,
      rank: 1,
      bankrupt: false,
      ready: false
    };

    this.players.push(player);
    return player;
  }

  removePlayer(playerId) {
    const playerIndex = this.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
      throw new GameError('Player not found');
    }

    const player = this.players[playerIndex];
    this.availableColors.unshift(player.color);
    this.players.splice(playerIndex, 1);

    // Reassign host if needed
    if (this.host === playerId && this.players.length > 0) {
      this.host = this.players[0].id;
      this.emit('hostChanged', this.host);
    }

    return player;
  }

  // Game Settings
  updateSettings(setting, value) {
    this.validateGameNotStarted();
    
    if (!this.settings.hasOwnProperty(setting)) {
      throw new GameError('Invalid setting');
    }

    // Validate setting values
    switch(setting) {
      case 'time':
        if (value < 10 || value > 60) throw new GameError('Timer must be between 10-60 seconds');
        break;
      case 'rounds':
        if (value < 1 || value > 20) throw new GameError('Rounds must be between 1-20');
        break;
      case 'balance':
        if (value < 1 || value > 1000) throw new GameError('Starting balance must be between 1-1000');
        break;
    }

    this.settings[setting] = value;
    if (setting === 'time') {
      this.timer = value;
    }
    return value;
  }

  // Game State Management 
  startGame(startingBalance) {
    this.validateMinPlayers();
    this.active = true;
    this.players.forEach(player => {
      player.total = startingBalance;
    });
    return this.getGameState();
  }

  resetGame() {
    this.active = false;
    this.bets = [];
    this.dice = [];
    this.round = 1;
    this.players.forEach(player => {
      player.total = 0;
      player.net = 0;
      player.rank = 1;
      player.bankrupt = false;
      player.ready = false;
    });
    return this.getGameState();
  }

  // Betting System
  placeBet(playerId, amount, animal) {
    const player = this.getPlayer(playerId);
    this.validateBet(player, amount, animal);

    const existingBet = this.bets.find(b => b.id === playerId && b.animal === animal);
    
    if (existingBet) {
      existingBet.amount += amount;
    } else {
      this.bets.push({
        id: playerId,
        animal,
        amount,
        color: player.color
      });
    }

    player.total -= amount;
    player.net -= amount;
    return this.getGameState();
  }

  removeBet(playerId, amount, animal) {
    const player = this.getPlayer(playerId);
    const betIndex = this.bets.findIndex(b => b.id === playerId && b.animal === animal);
    
    if (betIndex === -1) {
      throw new GameError('Bet not found');
    }

    this.bets.splice(betIndex, 1);
    player.total += amount;
    player.net += amount;
    return this.getGameState();
  }

  // Game Round Management
  rollDice() {
    const shuffledAnimals = this.shuffleArray([...GameRoom.ANIMALS]);
    this.dice = Array(3).fill(null).map(() => {
      const index = Math.floor(Math.random() * GameRoom.ANIMALS.length);
      return shuffledAnimals[index];
    });
    return this.getGameState();
  }

  calculateResults() {
    const results = new Map();
    const seenAnimals = new Set();

    this.dice.forEach(animal => {
      const multiplier = seenAnimals.has(animal) ? 1 : 2;
      seenAnimals.add(animal);

      const winningBets = this.bets.filter(bet => bet.animal === animal);
      winningBets.forEach(bet => {
        const player = this.getPlayer(bet.id);
        player.net += bet.amount * multiplier;
      });
    });

    return this.getRankedPlayers();
  }

  finalizeRound() {
    // Calculate final totals
    this.players.forEach(player => {
      player.total += player.net > 0 ? player.net : 0;
      player.net = 0;
      player.ready = false;
      
      if (player.total === 0) {
        player.bankrupt = true;
        player.ready = true;
      }
    });

    this.bets = [];
    this.setRankings();
    
    // Check for game end conditions
    const isGameOver = this.round >= this.settings.rounds || this.isEveryoneBankrupt();
    
    if (!isGameOver) {
      this.round++;
    }

    return {
      gameState: this.getGameState(),
      isGameOver,
      rankings: this.getRankedPlayers()
    };
  }

  // Timer Management
  resetTimer() {
    this.timer = this.settings.time;
    return this.timer;
  }

  updateTimer() {
    if (this.areAllPlayersReady()) {
      return null;
    }
    this.timer--;
    return this.timer;
  }

  // Chat System
  addMessage(playerId, name, message) {
    const player = this.getPlayer(playerId);
    const messageObj = {
      name,
      color: player.color,
      message: this.sanitizeMessage(message),
      timestamp: new Date()
    };
    this.messages.push(messageObj);
    return this.messages;
  }

  // Helper Methods
  private getPlayer(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) {
      throw new GameError('Player not found');
    }
    return player;
  }

  private getNextColor() {
    if (this.availableColors.length === 0) {
      throw new GameError('No colors available');
    }
    return this.availableColors.shift();
  }

  private validateMaxPlayers() {
    if (this.players.length >= 8) {
      throw new GameError('Room is full');
    }
  }

  private validateMinPlayers() {
    if (this.players.length < 2) {
      throw new GameError('Not enough players to start');
    }
  }

  private validateGameNotStarted() {
    if (this.active) {
      throw new GameError('Game already started');
    }
  }

  private validateBet(player, amount, animal) {
    if (!GameRoom.ANIMALS.includes(animal)) {
      throw new GameError('Invalid animal selection');
    }
    if (amount <= 0 || amount > player.total) {
      throw new GameError('Invalid bet amount');
    }
    if (player.bankrupt) {
      throw new GameError('Player is bankrupt');
    }
  }

  private setRankings() {
    const sortedPlayers = [...this.players].sort((a, b) => b.total - a.total);
    
    let currentRank = 1;
    let prevScore = sortedPlayers[0].total;
    
    sortedPlayers.forEach((player, index) => {
      if (player.total < prevScore) {
        currentRank = index + 1;
        prevScore = player.total;
      }
      player.rank = currentRank;
    });
  }

  private shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  private sanitizeMessage(message) {
    // Basic message sanitization
    return message.trim().slice(0, 500);
  }

  // State Getters
  getGameState() {
    return {
      roomId: this.roomId,
      active: this.active,
      host: this.host,
      players: this.players,
      bets: this.bets,
      dice: this.dice,
      settings: this.settings,
      round: this.round,
      timer: this.timer
    };
  }

  getRankedPlayers() {
    return [...this.players].sort((a, b) => b.net - a.net);
  }

  areAllPlayersReady() {
    return this.players.every(p => p.ready);
  }

  isEveryoneBankrupt() {
    return this.players.every(p => p.bankrupt);
  }
}

// GameRoomManager for handling multiple rooms
class GameRoomManager {
  constructor() {
    this.rooms = new Map();
  }

  createRoom(roomId, hostId) {
    if (this.rooms.has(roomId)) {
      throw new GameError('Room already exists');
    }
    const room = new GameRoom(roomId, hostId);
    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new GameError('Room not found');
    }
    return room;
  }

  removeRoom(roomId) {
    if (!this.rooms.delete(roomId)) {
      throw new GameError('Room not found');
    }
  }

  cleanupEmptyRooms() {
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.players.length === 0) {
        this.rooms.delete(roomId);
      }
    }
  }
}

module.exports = {
  GameRoom,
  GameRoomManager
};