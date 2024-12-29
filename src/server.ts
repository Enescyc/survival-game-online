import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { GameState, Player, Position, Resource, SafeZone } from './types/GameTypes';
import { json } from 'express';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["*"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

app.use(json());

// Also add CORS middleware to Express
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

// Game constants
const GAME_DURATION = 2 * 60; // 2 minutes in seconds
const DAY_NIGHT_CYCLE = 60; // 1 minute per cycle
const MAP_SIZE = { width: 800, height: 600 };
const RESOURCE_COUNT = 20;
const RESOURCE_COLLECTION_RADIUS = 20; // Distance within which a player can collect resources
const TICK_RATE = 60; // Server updates per second
const TICK_INTERVAL = 1000 / TICK_RATE;
const MAX_RESOURCE_VALUE = 100; // Maximum resource value (100%)
const MAX_RESOURCE_FILL = 10;   // Maximum amount a resource can fill per collection

// Add these constants for resource spawning
const RESOURCE_SPAWN_INTERVAL = 5000; // Spawn resources every 5 seconds
const MIN_RESOURCES = 15; // Minimum resources on map
const MAX_RESOURCES = 30; // Maximum resources on map
const MIN_RESOURCE_AMOUNT = 1;
const MAX_RESOURCE_AMOUNT = MAX_RESOURCE_FILL; // Set to 10 (MAX_RESOURCE_FILL)

// Add resource spawn positions configuration
const RESOURCE_SPAWN_ZONES = [
  { x: 100, y: 100, radius: 150 }, // Top left zone
  { x: MAP_SIZE.width - 100, y: 100, radius: 150 }, // Top right zone
  { x: MAP_SIZE.width / 2, y: MAP_SIZE.height / 2, radius: 200 }, // Center zone
  { x: 100, y: MAP_SIZE.height - 100, radius: 150 }, // Bottom left zone
  { x: MAP_SIZE.width - 100, y: MAP_SIZE.height - 100, radius: 150 }, // Bottom right zone
];

// Add this type for movement state
interface PlayerMovement {
  targetPosition: Position;
  isMoving: boolean;
}

// Add movement state tracking
const playerMovements = new Map<string, PlayerMovement>();

// Initialize game state
const gameState: GameState = {
  players: new Map(),
  resources: [],
  safeZones: [],
  isDayTime: true,
  timeRemaining: GAME_DURATION,
  gameStatus: 'waiting'
};

// Generate random resources
function generateResources(): Resource[] {
  const resources: Resource[] = [];
  const types: Array<'food' | 'water' | 'oxygen'> = ['food', 'water', 'oxygen'];

  for (let i = 0; i < RESOURCE_COUNT; i++) {
    resources.push({
      id: `resource-${i}`,
      type: types[Math.floor(Math.random() * types.length)],
      position: {
        x: Math.random() * MAP_SIZE.width,
        y: Math.random() * MAP_SIZE.height
      },
      // Ensure initial resources also respect MAX_RESOURCE_FILL
      amount: Math.floor(Math.random() * MAX_RESOURCE_FILL) + 1
    });
  }
  return resources;
}

// Generate safe zones
function generateSafeZones(): SafeZone[] {
  return [{
    id: 'safe-zone-1',
    position: {
      x: Math.random() * MAP_SIZE.width,
      y: Math.random() * MAP_SIZE.height
    },
    radius: 50
  }];
}

// Add this function to check distance between two positions
function getDistance(pos1: Position, pos2: Position): number {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Add this function to check for resource collection
function checkResourceCollection(player: Player, resources: Resource[]): Resource | null {
  for (const resource of resources) {
    const distance = Math.sqrt(
      Math.pow(player.position.x - resource.position.x, 2) +
      Math.pow(player.position.y - resource.position.y, 2)
    );

    if (distance < RESOURCE_COLLECTION_RADIUS) {
      // Add score based on resource amount
      player.score += Math.floor(resource.amount / 10);
      return resource;
    }
  }
  return null;
}

// Add type for registration data
interface RegistrationData {
  name: string;
}

// Update socket connection handling
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Handle player registration
  socket.on('register', (data: RegistrationData) => {
    console.log('Player registered:', socket.id, data.name); // Add logging

    const newPlayer: Player = {
      id: socket.id,
      name: data.name,
      position: {
        x: Math.random() * MAP_SIZE.width,
        y: Math.random() * MAP_SIZE.height
      },
      resources: {
        food: MAX_RESOURCE_VALUE,
        water: MAX_RESOURCE_VALUE,
        oxygen: MAX_RESOURCE_VALUE
      },
      score: 0,
      isInSafeZone: false
    };

    // Add player to game state
    gameState.players.set(socket.id, newPlayer);

    // Broadcast to all clients that a new player joined
    io.emit('playerJoined', newPlayer);

    // Send current game state to the new player
    socket.emit('gameState', {
      ...gameState,
      players: Array.from(gameState.players.values())
    });
  });

  // Handle player movement
  socket.on('movePlayer', (position: { x: number; y: number }) => {
    const player = gameState.players.get(socket.id);
    if (player) {
      // Update movement state
      playerMovements.set(socket.id, {
        targetPosition: position,
        isMoving: true
      });
    }
  });

  // Handle resource collection
  socket.on('collectResource', () => {
    const player = gameState.players.get(socket.id);
    if (!player) return;

    const collectedResource = checkResourceCollection(player, gameState.resources);
    if (collectedResource) {
      // Calculate how much can be added without exceeding MAX_RESOURCE_VALUE
      const currentValue = player.resources[collectedResource.type];
      const maxAddition = Math.min(
        Math.min(collectedResource.amount, MAX_RESOURCE_FILL), // Can't add more than MAX_RESOURCE_FILL
        Math.max(0, MAX_RESOURCE_VALUE - currentValue)         // Can't exceed MAX_RESOURCE_VALUE
      );

      if (maxAddition > 0) {
        // Update player's resource
        player.resources[collectedResource.type] = currentValue + maxAddition;

        // Remove the collected resource
        gameState.resources = gameState.resources.filter(r => r.id !== collectedResource.id);

        // Emit the collection event
        io.emit('resourceCollected', {
          resourceId: collectedResource.id,
          playerId: socket.id,
          newResourceValue: player.resources[collectedResource.type]
        });
      }
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    gameState.players.delete(socket.id);
    playerMovements.delete(socket.id);
    io.emit('playerDisconnected', socket.id);
  });
});

// Game loop
function gameLoop() {
  if (gameState.gameStatus === 'running') {
    // Update time remaining
    gameState.timeRemaining--;

    // Toggle day/night cycle
    if (gameState.timeRemaining % DAY_NIGHT_CYCLE === 0) {
      gameState.isDayTime = !gameState.isDayTime;
      io.emit('dayNightChange', gameState.isDayTime);
    }

    // Update player resources
    gameState.players.forEach((player) => {
      const resourceDepletionRate = player.isInSafeZone || gameState.isDayTime ? 1 : 2;
      
      player.resources.food = Math.max(0, player.resources.food - resourceDepletionRate);
      player.resources.water = Math.max(0, player.resources.water - resourceDepletionRate);
      player.resources.oxygen = Math.max(0, player.resources.oxygen - resourceDepletionRate);

      // Check if player is dead
      if (player.resources.food === 0 || player.resources.water === 0 || player.resources.oxygen === 0) {
        io.to(player.id).emit('gameOver', player.score);
      }

      // Update player score
      player.score = calculateScore(player);
    });

    // Emit updated game state
    io.emit('gameStateUpdate', {
      ...gameState,
      players: Array.from(gameState.players.values())
    });

    // Check if game is finished
    if (gameState.timeRemaining <= 0) {
      gameState.gameStatus = 'finished';
      io.emit('gameFinished', Array.from(gameState.players.values()));
    }
  }
}

// Start game loop
setInterval(gameLoop, 1000);

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Initialize game
function initializeGame() {
  gameState.resources = generateResources();
  gameState.safeZones = generateSafeZones();
  gameState.timeRemaining = GAME_DURATION;
  gameState.isDayTime = true;
  gameState.gameStatus = 'running';
}

// Endpoint to start new game
app.post('/start-game', (req, res) => {
  gameState.gameStatus = 'running';
  gameState.timeRemaining = GAME_DURATION;
  gameState.isDayTime = true;
  gameState.resources = generateResources();
  gameState.safeZones = generateSafeZones();
  
  // Start resource spawning when game starts
  startResourceSpawning();
  
  io.emit('gameStarted');
  io.emit('gameStateUpdate', gameState);
  res.status(200).send('Game started');
});

// Add error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Add health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    gameStatus: gameState.gameStatus,
    players: gameState.players.size,
    timeRemaining: gameState.timeRemaining
  });
});

// Add function to check if player is in safe zone
function checkPlayerInSafeZone(player: Player): boolean {
  return gameState.safeZones.some(zone => {
    const dx = player.position.x - zone.position.x;
    const dy = player.position.y - zone.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= zone.radius;
  });
}

// Add function to calculate player score
function calculateScore(player: Player): number {
  return Math.floor(
    (player.resources.food + 
     player.resources.water + 
     player.resources.oxygen) * 
    (gameState.timeRemaining / GAME_DURATION)
  );
}

// Add server-side movement update loop
function updatePlayerPositions() {
  playerMovements.forEach((movement, playerId) => {
    const player = gameState.players.get(playerId);
    if (player && movement.isMoving) {
      const dx = movement.targetPosition.x - player.position.x;
      const dy = movement.targetPosition.y - player.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 1) {
        // Player has reached target
        player.position = movement.targetPosition;
        movement.isMoving = false;
      } else {
        // Move player towards target
        const speed = 5; // Adjust this value to change movement speed
        const moveX = (dx / distance) * speed;
        const moveY = (dy / distance) * speed;
        
        player.position.x += moveX;
        player.position.y += moveY;

        // Check for resource collection after movement
        const collectedResource = checkResourceCollection(player, gameState.resources);
        if (collectedResource) {
          // Remove the resource from the game state
          gameState.resources = gameState.resources.filter(r => r.id !== collectedResource.id);
          
          // Add the resource to player's inventory
          player.resources[collectedResource.type] = Math.min(
            100,
            player.resources[collectedResource.type] + collectedResource.amount
          );

          // Emit resource collection event
          io.emit('resourceCollected', {
            resourceId: collectedResource.id,
            playerId,
            newResourceValue: player.resources[collectedResource.type]
          });
        }

        // Update safe zone status
        player.isInSafeZone = checkPlayerInSafeZone(player);
      }
    }
  });

  // Emit positions for all moving players
  const movingPlayers = Array.from(gameState.players.values())
    .filter(player => playerMovements.get(player.id)?.isMoving);

  if (movingPlayers.length > 0) {
    io.emit('playersUpdate', movingPlayers);
  }
}

// Start position update loop
setInterval(updatePlayerPositions, TICK_INTERVAL);

// Add helper function to get random position in a zone
function getRandomPositionInZone(zone: { x: number; y: number; radius: number }) {
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.random() * zone.radius;
  return {
    x: zone.x + Math.cos(angle) * radius,
    y: zone.y + Math.sin(angle) * radius
  };
}

// Add function to spawn a single resource
function spawnResource(): Resource {
  const types: Array<'food' | 'water' | 'oxygen'> = ['food', 'water', 'oxygen'];
  const randomZone = RESOURCE_SPAWN_ZONES[Math.floor(Math.random() * RESOURCE_SPAWN_ZONES.length)];
  const position = getRandomPositionInZone(randomZone);

  // Ensure amount is between 1 and MAX_RESOURCE_FILL (10)
  const amount = Math.floor(Math.random() * MAX_RESOURCE_FILL) + 1;

  return {
    id: `resource-${Date.now()}-${Math.random()}`,
    type: types[Math.floor(Math.random() * types.length)],
    position,
    amount
  };
}

// Add resource spawning system
function startResourceSpawning() {
  setInterval(() => {
    if (gameState.gameStatus !== 'running') return;

    const currentResourceCount = gameState.resources.length;
    
    // Don't spawn if we're at max capacity
    if (currentResourceCount >= MAX_RESOURCES) return;

    // Spawn more resources if we're below minimum
    if (currentResourceCount < MIN_RESOURCES) {
      const resourcesToSpawn = MIN_RESOURCES - currentResourceCount;
      for (let i = 0; i < resourcesToSpawn; i++) {
        gameState.resources.push(spawnResource());
      }
    } else {
      // Randomly spawn a resource with 50% chance
      if (Math.random() < 0.5) {
        gameState.resources.push(spawnResource());
      }
    }

    // Emit updated resources to all clients
    io.emit('gameStateUpdate', gameState);
  }, RESOURCE_SPAWN_INTERVAL);
} 