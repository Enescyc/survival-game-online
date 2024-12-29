"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const express_2 = require("express");
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["*"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});
app.use((0, express_2.json)());
// Also add CORS middleware to Express
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    next();
});
// Game constants - Update these values for testing
const GAME_DURATION = 120; // 2 minutes in seconds
const PREPARATION_TIME = 3; // 3 seconds for testing
const GAME_CYCLE_TIME = GAME_DURATION + PREPARATION_TIME; // 123 seconds total
const DAY_NIGHT_CYCLE = 30; // Change day/night every 30 seconds
const MAP_SIZE = { width: 800, height: 600 };
const RESOURCE_COUNT = 20;
const RESOURCE_COLLECTION_RADIUS = 20; // Distance within which a player can collect resources
const TICK_RATE = 60; // Server updates per second
const TICK_INTERVAL = 1000 / TICK_RATE;
const MAX_RESOURCE_VALUE = 100; // Maximum resource value (100%)
const MAX_RESOURCE_FILL = 10; // Maximum amount a resource can fill per collection
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
// Add movement state tracking
const playerMovements = new Map();
// Initialize game state
const gameState = {
    players: new Map(),
    resources: [],
    safeZones: [],
    isDayTime: true,
    timeRemaining: GAME_DURATION,
    gameStatus: 'waiting'
};
// Generate random resources
function generateResources() {
    const resources = [];
    const types = ['food', 'water', 'oxygen'];
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
function generateSafeZones() {
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
function getDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
}
// Add this function to check for resource collection
function checkResourceCollection(player, resources) {
    for (const resource of resources) {
        const distance = getDistance(player.position, resource.position);
        if (distance < RESOURCE_COLLECTION_RADIUS) {
            // Add score based on resource amount (1 point per resource unit)
            player.score += resource.amount;
            return resource;
        }
    }
    return null;
}
// Add after other interface/type definitions
const leaderboard = [];
const MAX_LEADERBOARD_ENTRIES = 10;
// Add this function to handle leaderboard updates
function updateLeaderboard(playerName, score) {
    const existingEntry = leaderboard.find(entry => entry.playerName === playerName);
    if (existingEntry) {
        if (score > existingEntry.score) {
            existingEntry.score = score;
            leaderboard.sort((a, b) => b.score - a.score);
        }
    }
    else {
        leaderboard.push({ playerName, score });
        leaderboard.sort((a, b) => b.score - a.score);
        if (leaderboard.length > MAX_LEADERBOARD_ENTRIES) {
            leaderboard.pop();
        }
    }
}
// Update socket connection handling
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);
    // Handle player registration
    socket.on('register', (data) => {
        console.log('Player registered:', socket.id, data.name);
        const newPlayer = {
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
            isInSafeZone: false,
            isSpectator: false
        };
        // Add player to game state
        gameState.players.set(socket.id, newPlayer);
        // Broadcast to all clients that a new player joined
        io.emit('playerJoined', newPlayer);
        // Send current game state to the new player
        socket.emit('gameState', Object.assign(Object.assign({}, gameState), { players: Array.from(gameState.players.values()) }));
    });
    // Handle player movement
    socket.on('movePlayer', (position) => {
        const player = gameState.players.get(socket.id);
        if (player && !player.isSpectator) {
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
        if (!player || player.isSpectator)
            return;
        const collectedResource = checkResourceCollection(player, gameState.resources);
        if (collectedResource) {
            // Calculate how much can be added without exceeding MAX_RESOURCE_VALUE
            const currentValue = player.resources[collectedResource.type];
            const maxAddition = Math.min(Math.min(collectedResource.amount, MAX_RESOURCE_FILL), // Can't add more than MAX_RESOURCE_FILL
            Math.max(0, MAX_RESOURCE_VALUE - currentValue) // Can't exceed MAX_RESOURCE_VALUE
            );
            if (maxAddition > 0) {
                // Update player's resource
                player.resources[collectedResource.type] = currentValue + maxAddition;
                // Remove the collected resource
                gameState.resources = gameState.resources.filter(r => r.id !== collectedResource.id);
                // Emit the collection event with updated score
                io.emit('resourceCollected', {
                    resourceId: collectedResource.id,
                    playerId: socket.id,
                    newResourceValue: player.resources[collectedResource.type],
                    playerScore: player.score
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
    // Add in the WebSocket message handling section
    socket.on('gameOver', (data) => {
        updateLeaderboard(data.playerName, data.score);
        io.emit('leaderboardUpdate', leaderboard);
    });
});
// Add this function to check if player is dead
function isPlayerDead(player) {
    return player.resources.food === 0 &&
        player.resources.water === 0 &&
        player.resources.oxygen === 0;
}
// Update the updatePlayerPositions function
function updatePlayerPositions() {
    playerMovements.forEach((movement, playerId) => {
        const player = gameState.players.get(playerId);
        if (player && movement.isMoving && !player.isSpectator) {
            const dx = movement.targetPosition.x - player.position.x;
            const dy = movement.targetPosition.y - player.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 1) {
                // Player has reached target
                player.position = movement.targetPosition;
                movement.isMoving = false;
            }
            else {
                // Calculate base speed and check for resource depletion
                let speed = 5; // Base speed
                if (player.resources.food === 0 ||
                    player.resources.water === 0 ||
                    player.resources.oxygen === 0) {
                    speed = speed / 2; // Reduce speed by half if any resource is depleted
                }
                // Move player towards target
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
                    player.resources[collectedResource.type] = Math.min(100, player.resources[collectedResource.type] + collectedResource.amount);
                    // Emit resource collection event
                    io.emit('resourceCollected', {
                        resourceId: collectedResource.id,
                        playerId,
                        newResourceValue: player.resources[collectedResource.type],
                        playerScore: player.score
                    });
                }
                // Update safe zone status
                player.isInSafeZone = checkPlayerInSafeZone(player);
                // Check if player is completely dead
                if (isPlayerDead(player)) {
                    handlePlayerDeath(playerId);
                    return;
                }
            }
        }
    });
    // Emit positions for all moving players
    const movingPlayers = Array.from(gameState.players.values())
        .filter(player => { var _a; return (_a = playerMovements.get(player.id)) === null || _a === void 0 ? void 0 : _a.isMoving; });
    if (movingPlayers.length > 0) {
        io.emit('playersUpdate', movingPlayers);
    }
}
// Start position update loop
setInterval(updatePlayerPositions, TICK_INTERVAL);
// Update the game loop to handle day/night cycle
function gameLoop() {
    if (gameState.gameStatus === 'running') {
        gameState.timeRemaining--;
        // Toggle day/night cycle every 30 seconds
        if (gameState.timeRemaining % DAY_NIGHT_CYCLE === 0) {
            gameState.isDayTime = !gameState.isDayTime;
            io.emit('dayNightChange', gameState.isDayTime);
        }
        // Update player resources with new depletion rules
        gameState.players.forEach((player) => {
            // Base depletion rate
            let depletionRate = 5;
            // Only decrease resources if:
            // 1. It's daytime (always decrease during day) OR
            // 2. Player is not in safe zone during night
            if (gameState.isDayTime || !player.isInSafeZone) {
                // If it's night time and player is not in safe zone, increase depletion rate
                if (!gameState.isDayTime && !player.isInSafeZone) {
                    depletionRate = 15; // Higher penalty for being outside during night
                }
                // Update each resource type
                player.resources.food = Math.max(0, player.resources.food - depletionRate);
                player.resources.water = Math.max(0, player.resources.water - depletionRate);
                player.resources.oxygen = Math.max(0, player.resources.oxygen - depletionRate);
                // Check if player is completely dead
                if (isPlayerDead(player)) {
                    handlePlayerDeath(player.id);
                }
            }
            // If player is in safe zone during night, no resource depletion
        });
        // Emit game state update
        io.emit('gameStateUpdate', Object.assign(Object.assign({}, gameState), { players: Array.from(gameState.players.values()) }));
        if (gameState.timeRemaining <= 0) {
            endGame();
        }
    }
}
// Make sure game loop starts
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
// Add new game state tracking
let gameTimer = null;
let preparationTimer = null;
// Add this function to handle game cycles
function startGameCycle() {
    // Reset game state
    gameState.gameStatus = 'waiting';
    gameState.timeRemaining = PREPARATION_TIME;
    // Clear existing resources
    gameState.resources = [];
    // Reset players but keep spectators as spectators
    gameState.players.forEach(player => {
        if (!player.isSpectator) {
            player.score = 0;
            player.resources = {
                food: MAX_RESOURCE_VALUE,
                water: MAX_RESOURCE_VALUE,
                oxygen: MAX_RESOURCE_VALUE
            };
        }
    });
    // Broadcast preparation phase
    io.emit('preparationPhase', {
        message: 'New game starting soon',
        timeRemaining: PREPARATION_TIME
    });
    // Start preparation countdown
    if (preparationTimer)
        clearInterval(preparationTimer);
    preparationTimer = setInterval(() => {
        gameState.timeRemaining--;
        // Emit the current preparation time to all clients
        io.emit('preparationUpdate', gameState.timeRemaining);
        if (gameState.timeRemaining <= 0) {
            clearInterval(preparationTimer);
            startGame();
        }
    }, 1000);
}
// Update the startGame function
function startGame() {
    // Check if there are any active (non-spectator) players
    const activePlayers = Array.from(gameState.players.values())
        .filter(p => !p.isSpectator);
    if (activePlayers.length === 0) {
        console.log('No active players present, restarting preparation phase');
        startGameCycle();
        return;
    }
    // Initialize game state
    gameState.gameStatus = 'running';
    gameState.timeRemaining = GAME_DURATION;
    gameState.isDayTime = true;
    gameState.resources = generateResources();
    gameState.safeZones = generateSafeZones();
    // Start resource spawning
    startResourceSpawning();
    // Broadcast game start
    io.emit('gameStarted', Object.assign(Object.assign({}, gameState), { players: Array.from(gameState.players.values()) }));
}
// Add end game function
function endGame() {
    // Clear timers
    if (gameTimer)
        clearInterval(gameTimer);
    // Update game state
    gameState.gameStatus = 'finished';
    // Calculate final scores and get winner
    const players = Array.from(gameState.players.values());
    const winner = players === null || players === void 0 ? void 0 : players.reduce((prev, current) => (prev.score > current.score) ? prev : current);
    // Broadcast game end
    io.emit('gameFinished', {
        winner,
        finalScores: players.map(p => ({
            id: p.id,
            name: p.name,
            score: p.score
        }))
    });
    // Reset all players' scores
    gameState.players.forEach(player => {
        player.score = 0;
        player.resources = {
            food: MAX_RESOURCE_VALUE,
            water: MAX_RESOURCE_VALUE,
            oxygen: MAX_RESOURCE_VALUE
        };
    });
    // Start new game cycle after a short delay
    setTimeout(startGameCycle, 5000);
}
// Make sure to start the game cycle when server starts
startGameCycle();
// Remove the existing /start-game endpoint since games start automatically
app.post('/start-game', (req, res) => {
    res.status(400).json({ error: 'Games start automatically every 3 minutes' });
});
// Add endpoint to get current game status
app.get('/game-status', (req, res) => {
    res.json({
        status: gameState.gameStatus,
        timeRemaining: gameState.timeRemaining,
        players: gameState.players.size,
        nextGameIn: gameState.gameStatus === 'finished' ?
            5 : gameState.gameStatus === 'waiting' ?
            gameState.timeRemaining : GAME_CYCLE_TIME - (GAME_DURATION - gameState.timeRemaining)
    });
});
// Add error handling middleware
app.use((err, req, res, next) => {
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
function checkPlayerInSafeZone(player) {
    return gameState.safeZones.some(zone => {
        const dx = player.position.x - zone.position.x;
        const dy = player.position.y - zone.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= zone.radius;
    });
}
// Add helper function to get random position in a zone
function getRandomPositionInZone(zone) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * zone.radius;
    return {
        x: zone.x + Math.cos(angle) * radius,
        y: zone.y + Math.sin(angle) * radius
    };
}
// Add function to spawn a single resource
function spawnResource() {
    const types = ['food', 'water', 'oxygen'];
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
        if (gameState.gameStatus !== 'running')
            return;
        const currentResourceCount = gameState.resources.length;
        // Don't spawn if we're at max capacity
        if (currentResourceCount >= MAX_RESOURCES)
            return;
        // Spawn more resources if we're below minimum
        if (currentResourceCount < MIN_RESOURCES) {
            const resourcesToSpawn = MIN_RESOURCES - currentResourceCount;
            for (let i = 0; i < resourcesToSpawn; i++) {
                gameState.resources.push(spawnResource());
            }
        }
        else {
            // Randomly spawn a resource with 50% chance
            if (Math.random() < 0.5) {
                gameState.resources.push(spawnResource());
            }
        }
        // Emit updated resources to all clients
        io.emit('gameStateUpdate', gameState);
    }, RESOURCE_SPAWN_INTERVAL);
}
// Update the player death handling in updatePlayerPositions and gameLoop
function handlePlayerDeath(playerId) {
    const player = gameState.players.get(playerId);
    if (player) {
        player.isSpectator = true;
        // Reset resources but keep the player in the game
        player.resources = {
            food: 0,
            water: 0,
            oxygen: 0
        };
        // Notify the player and others
        io.to(playerId).emit('playerDied');
        io.emit('playerBecameSpectator', {
            playerId,
            playerName: player.name
        });
    }
}
// Add a new endpoint to get initial leaderboard data
app.get('/api/leaderboard', (req, res) => {
    res.json(leaderboard);
});
