import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { GameState, Position } from '../types/GameTypes';
import CanvasOverlay from './CanvasOverlay';
import { Socket } from 'socket.io-client';

interface GameCanvasProps {
  gameState: GameState;
  playerId: string;
  onMove: (position: Position) => void;
  socket: Socket;
}

// Lerp helper function
const lerp = (start: number, end: number, t: number) => {
  return start * (1 - t) + end * t;
};

const MOVEMENT_SPEED = 0.15; // Slightly slower interpolation for smoother movement
const POSITION_THRESHOLD = 0.5; // Larger threshold for position snapping
const PLAYER_SIZE = 16;
const KEYBOARD_SPEED = 4; // Slightly faster keyboard movement
const DIAGONAL_MODIFIER = 0.707; // 1/√2, for diagonal movement normalization
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;


interface KeyState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

// Add these constants for visual effects

// Add these constants for enhanced visuals

const RESOURCE_ICONS = {
  food: '🍖',
  water: '💧',
  oxygen: '⭐'
};

// Add this interface for particle effects

// Add these constants


// Add these constants at the top
const TOUCH_DEAD_ZONE = 10;
const TOUCH_DIRECTION_SPEED = 5;

interface PlayerVisual {
  id: string;
  name: string;
  visualPosition: Position;
  targetPosition: Position;
  resources: {
    food: number;
    water: number;
    oxygen: number;
  };
  score: number;
  isInSafeZone: boolean;
  isSpectator: boolean;
}

// Add this interface
interface JoystickState {
  active: boolean;
  startPosition: Position;
  currentPosition: Position;
}

// Add these constants for enhanced visuals
const RESOURCE_GLOW = {
  food: 'rgba(255, 215, 0, 0.6)',
  water: 'rgba(135, 206, 250, 0.6)',
  oxygen: 'rgba(240, 255, 255, 0.6)'
};

// Add these constants at the top
const DAY_GRADIENT_COLORS = {
  start: '#1a4569', // Deep blue
  middle: '#2a617d', // Medium blue
  end: '#3c7a91'    // Light blue
};

const NIGHT_GRADIENT_COLORS = {
  start: '#0a0a15', // Very dark blue
  middle: '#1a1a2e', // Dark blue
  end: '#2a2a3d'    // Medium dark blue
};

const GameCanvas = React.memo(({ gameState, playerId, onMove, socket }: GameCanvasProps) => {
  // Add this line at the top of the component
  const player = gameState.players.find(p => p.id === playerId);
  
  // Use refs for values that don't need to trigger re-renders
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playersRef = useRef<Map<string, PlayerVisual>>(new Map());
  const animationFrameRef = useRef<number>();
  const keyStateRef = useRef<KeyState>({
    up: false,
    down: false,
    left: false,
    right: false
  });
  const lastPositionRef = useRef<Position | null>(null);
  const moveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<number>(1);

  // Memoize state updates
  const [overlayPosition] = useState({ top: 0, right: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Memoize player updates
  useEffect(() => {
    const updatePlayers = () => {
      gameState.players.forEach(player => {
        const existingPlayer = playersRef.current.get(player.id);
        if (existingPlayer) {
          existingPlayer.targetPosition = player.position;
          existingPlayer.resources = player.resources;
          existingPlayer.score = player.score;
          existingPlayer.isInSafeZone = player.isInSafeZone;
          existingPlayer.name = player.name;
        } else {
          playersRef.current.set(player.id, {
            ...player,
            visualPosition: { ...player.position },
            targetPosition: { ...player.position },
            name: player.name
          });
        }
      });
    };

    updatePlayers();
  }, [gameState.players]);

  // Memoize the update positions function
  const updatePositions = useCallback(() => {
    playersRef.current.forEach(player => {
      if (player.visualPosition.x !== player.targetPosition.x || 
          player.visualPosition.y !== player.targetPosition.y) {
        
        const dx = player.targetPosition.x - player.visualPosition.x;
        const dy = player.targetPosition.y - player.visualPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < POSITION_THRESHOLD) {
          player.visualPosition.x = player.targetPosition.x;
          player.visualPosition.y = player.targetPosition.y;
        } else {
          player.visualPosition.x = lerp(player.visualPosition.x, player.targetPosition.x, MOVEMENT_SPEED);
          player.visualPosition.y = lerp(player.visualPosition.y, player.targetPosition.y, MOVEMENT_SPEED);
        }
      }
    });
  }, []);

  // Move this function before the render function
  const processKeyboardMovement = useCallback(() => {
    const player = playersRef.current.get(playerId);
    if (!player || player.isSpectator) return; // Add spectator check

    const keys = keyStateRef.current;
    let dx = 0;
    let dy = 0;

    if (keys.up) dy -= 1;
    if (keys.down) dy += 1;
    if (keys.left) dx -= 1;
    if (keys.right) dx += 1;

    // If there's movement
    if (dx !== 0 || dy !== 0) {
      // Normalize diagonal movement
      if (dx !== 0 && dy !== 0) {
        dx *= DIAGONAL_MODIFIER;
        dy *= DIAGONAL_MODIFIER;
      }

      // Calculate new position
      const newX = Math.max(0, Math.min(GAME_WIDTH, player.targetPosition.x + dx * KEYBOARD_SPEED));
      const newY = Math.max(0, Math.min(GAME_HEIGHT, player.targetPosition.y + dy * KEYBOARD_SPEED));

      // Only send update if position has changed significantly and player is not spectator
      if (!lastPositionRef.current ||
          getDistance(lastPositionRef.current, { x: newX, y: newY }) > 1) {
        
        // Update the target position immediately for smooth local movement
        player.targetPosition = { x: newX, y: newY };
        
        // Throttle network updates
        if (!moveTimeoutRef.current) {
          moveTimeoutRef.current = setTimeout(() => {
            if (!player.isSpectator) { // Double check spectator status
              onMove({ x: newX, y: newY });
              lastPositionRef.current = { x: newX, y: newY };
            }
            moveTimeoutRef.current = null;
          }, 16);
        }
      }
    }
  }, [playerId, onMove]);

  // The render function that uses processKeyboardMovement
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // Create dynamic gradient based on time of day
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    
    if (gameState.isDayTime) {
      // Day gradient
      gradient.addColorStop(0, DAY_GRADIENT_COLORS.start);
      gradient.addColorStop(0.5, DAY_GRADIENT_COLORS.middle);
      gradient.addColorStop(1, DAY_GRADIENT_COLORS.end);
      
      // Add subtle sun effect
      const sunGradient = ctx.createRadialGradient(
        GAME_WIDTH * 0.8, GAME_HEIGHT * 0.2, // Sun position
        0,
        GAME_WIDTH * 0.8, GAME_HEIGHT * 0.2,
        GAME_HEIGHT * 0.4
      );
      sunGradient.addColorStop(0, 'rgba(255, 200, 100, 0.2)');
      sunGradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
      
      // Draw base gradient
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      
      // Draw sun effect
      ctx.fillStyle = sunGradient;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    } else {
      // Night gradient
      gradient.addColorStop(0, NIGHT_GRADIENT_COLORS.start);
      gradient.addColorStop(0.5, NIGHT_GRADIENT_COLORS.middle);
      gradient.addColorStop(1, NIGHT_GRADIENT_COLORS.end);
      
      // Add stars effect
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      
      // Draw stars
      for (let i = 0; i < 100; i++) {
        const x = Math.sin(i * 0.1 + Date.now() * 0.001) * GAME_WIDTH + GAME_WIDTH / 2;
        const y = Math.cos(i * 0.1 + Date.now() * 0.001) * GAME_HEIGHT + GAME_HEIGHT / 2;
        const size = Math.sin(Date.now() * 0.003 + i) * 0.5 + 1;
        const alpha = Math.sin(Date.now() * 0.002 + i) * 0.3 + 0.7;
        
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x % GAME_WIDTH, y % GAME_HEIGHT, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw resources with enhanced effects
    gameState.resources.forEach(resource => {
      ctx.save();
      
      // Glow effect
      ctx.shadowColor = RESOURCE_GLOW[resource.type];
      ctx.shadowBlur = 15;
      
      // Pulse animation
      const pulse = Math.sin(Date.now() * 0.003) * 0.2 + 1;
      const baseSize = 8;
      const size = baseSize * pulse;
      
      // Draw resource circle with gradient
      const gradient = ctx.createRadialGradient(
        resource.position.x, resource.position.y, 0,
        resource.position.x, resource.position.y, size * 2
      );
      gradient.addColorStop(0, RESOURCE_GLOW[resource.type]);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(resource.position.x, resource.position.y, size * 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw resource icon
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(RESOURCE_ICONS[resource.type], resource.position.x, resource.position.y);
      
      ctx.restore();
    });

    // Draw safe zones with glow effect
    gameState.safeZones.forEach(zone => {
      ctx.save();
      
      // Create pulsing animation
      const pulseIntensity = Math.sin(Date.now() * 0.003) * 0.2 + 0.8;
      
      // Create gradient for the safe zone
      const gradient = ctx.createRadialGradient(
        zone.position.x, zone.position.y, 0,
        zone.position.x, zone.position.y, zone.radius
      );
      
      // Safe zone colors based on time of day
      const safeZoneColor = gameState.isDayTime ? 
        'rgba(255, 215, 0, 0.2)' : // Gold for day
        'rgba(135, 206, 250, 0.2)'; // Light blue for night
        
      gradient.addColorStop(0, safeZoneColor);
      gradient.addColorStop(0.7, safeZoneColor);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      // Draw the safe zone area
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(zone.position.x, zone.position.y, zone.radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw the safe zone border with glow
      ctx.strokeStyle = gameState.isDayTime ? 
        `rgba(255, 215, 0, ${0.5 * pulseIntensity})` :
        `rgba(135, 206, 250, ${0.5 * pulseIntensity})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = gameState.isDayTime ? '#FFD700' : '#87CEFA';
      ctx.shadowBlur = 15;
      ctx.stroke();
      
      // Add a subtle pattern or texture
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const x = zone.position.x + Math.cos(angle) * zone.radius;
        const y = zone.position.y + Math.sin(angle) * zone.radius;
        
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = gameState.isDayTime ? '#FFD700' : '#87CEFA';
        ctx.fill();
      }
      
      ctx.restore();
    });

    // Draw players without any animations or effects
    playersRef.current.forEach(player => {
      if (!player.isSpectator) {
        const { x, y } = player.visualPosition;
        
        ctx.save();
        
        // Draw player name
        if (player.name) {
          ctx.font = 'bold 14px Arial';
          ctx.textAlign = 'center';
          const nameWidth = ctx.measureText(player.name).width;
          
          // Name background
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(x - nameWidth/2 - 4, y - PLAYER_SIZE - 25, nameWidth + 8, 20);
          
          // Name text
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(player.name, x, y - PLAYER_SIZE - 12);
        }

        // Simple player circle
        const playerColor = player.id === playerId ? '#FF6B6B' : '#868E96';
        ctx.fillStyle = playerColor;
        ctx.beginPath();
        ctx.arc(x, y, PLAYER_SIZE, 0, Math.PI * 2);
        ctx.fill();
        
        // Simple outline
        ctx.strokeStyle = player.isInSafeZone ? '#FFD700' : '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.restore();
      }
    });

    // Process movement and continue animation
    processKeyboardMovement();
    updatePositions();
    animationFrameRef.current = requestAnimationFrame(render);
  }, [gameState, playerId, mousePos, processKeyboardMovement, updatePositions]);

  // Optimize resize handler

  // Add mouse move handler
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scale = scaleRef.current;
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    setMousePos({ x, y });
  }, []);
  // Add keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default behavior for game controls
      if (['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }

      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          keyStateRef.current.up = true;
          break;
        case 's':
        case 'arrowdown':
          keyStateRef.current.down = true;
          break;
        case 'a':
        case 'arrowleft':
          keyStateRef.current.left = true;
          break;
        case 'd':
        case 'arrowright':
          keyStateRef.current.right = true;
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          keyStateRef.current.up = false;
          break;
        case 's':
        case 'arrowdown':
          keyStateRef.current.down = false;
          break;
        case 'a':
        case 'arrowleft':
          keyStateRef.current.left = false;
          break;
        case 'd':
        case 'arrowright':
          keyStateRef.current.right = false;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Update transition in render
  const dayNightTransitionRef = useRef(gameState.isDayTime ? 1 : 0);
  const transitionSpeed = 0.05;
  useEffect(() => {
    if (gameState.isDayTime && dayNightTransitionRef.current < 1) {
      dayNightTransitionRef.current = Math.min(1, dayNightTransitionRef.current + transitionSpeed);
    } else if (!gameState.isDayTime && dayNightTransitionRef.current > 0) {
      dayNightTransitionRef.current = Math.max(0, dayNightTransitionRef.current - transitionSpeed);
    }
  }, [gameState.isDayTime, transitionSpeed]);

  // Update click handler to account for scaling
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (player?.isSpectator) return; // Use the player from component scope
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scale = scaleRef.current;
    
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    
    onMove({ x, y });

    const playerVisual = playersRef.current.get(playerId); // Renamed to avoid conflict
    if (playerVisual) {
      playerVisual.targetPosition = { x, y };
    }
  };

  // Add helper function for distance calculation
  const getDistance = (pos1: Position, pos2: Position): number => {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Start/stop animation loop
  useEffect(() => {
    render();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [render]);

  // Add touch handlers
  const [joystick, setJoystick] = useState<JoystickState>({
    active: false,
    startPosition: { x: 0, y: 0 },
    currentPosition: { x: 0, y: 0 }
  });

  // Update handleTouchStart
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scale = scaleRef.current;
    const touchX = (touch.clientX - rect.left) / scale;
    const touchY = (touch.clientY - rect.top) / scale;

    setJoystick({
      active: true,
      startPosition: { x: touchX, y: touchY },
      currentPosition: { x: touchX, y: touchY }
    });
  }, []);

  // Add touch duration check in handleTouchEnd
  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setJoystick({
      active: false,
      startPosition: { x: 0, y: 0 },
      currentPosition: { x: 0, y: 0 }
    });
  }, []);

  // Update touch handlers
  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!joystick.active) return;

    const touch = e.touches[0];
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scale = scaleRef.current;
    const currentX = (touch.clientX - rect.left) / scale;
    const currentY = (touch.clientY - rect.top) / scale;

    const dx = currentX - joystick.startPosition.x;
    const dy = currentY - joystick.startPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > TOUCH_DEAD_ZONE) {
      const player = playersRef.current.get(playerId);
      if (!player) return;

      // Normalize direction and apply constant speed
      const normalizedDx = dx / distance;
      const normalizedDy = dy / distance;

      const newX = Math.max(0, Math.min(GAME_WIDTH, player.targetPosition.x + normalizedDx * TOUCH_DIRECTION_SPEED));
      const newY = Math.max(0, Math.min(GAME_HEIGHT, player.targetPosition.y + normalizedDy * TOUCH_DIRECTION_SPEED));

      player.targetPosition = { x: newX, y: newY };
      onMove({ x: newX, y: newY });
    }

    // Update joystick visual position
    setJoystick(prev => ({
      ...prev,
      currentPosition: { x: currentX, y: currentY }
    }));
  }, [joystick.active, joystick.startPosition, playerId, onMove]);

  // In the handleGameOver function or wherever you handle game over
  socket.emit('gameOver', {
    playerName: gameState.players.find(p => p.id === playerId)?.name || 'Unknown',
    score: gameState.players.find(p => p.id === playerId)?.score || 0
  });

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full min-h-screen flex items-center justify-center bg-gray-900 relative overflow-hidden"
    >
      <div className="relative w-full h-full">
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="border border-gray-300 max-w-full max-h-full touch-none mx-auto"
          style={{ 
            imageRendering: 'pixelated',
            touchAction: 'none',
            WebkitTouchCallout: 'none',
            WebkitUserSelect: 'none',
            userSelect: 'none',
            cursor: player?.isSpectator ? 'default' : 'pointer'
          }}
        />
        {useMemo(() => (
          gameState.players.map(player => (
            player.id === playerId && (
              <CanvasOverlay 
                key={player.id} 
                player={player}
                position={overlayPosition}
                scale={scaleRef.current}
                isDayTime={gameState.isDayTime}
              />
            )
          ))
        ), [gameState.players, playerId, overlayPosition, gameState.isDayTime])}
        {window.innerWidth < 768 && !localStorage.getItem('mobileHintsShown') && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center text-white p-4">
            <div className="bg-gray-800/90 rounded-lg p-6 max-w-sm">
              <h3 className="text-xl mb-4">Mobile Controls</h3>
              <ul className="space-y-2 mb-4">
                <li>• Use the joystick to move</li>
                <li>• Double tap to collect resources</li>
                <li>• Long press for context menu</li>
                <li>• Use action buttons for special moves</li>
              </ul>
              <button 
                className="w-full bg-blue-500 py-2 rounded"
                onClick={() => {
                  localStorage.setItem('mobileHintsShown', 'true');
                  // Close hints
                }}
              >
                Got it!
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default GameCanvas; 