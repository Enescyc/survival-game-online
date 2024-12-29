import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { GameState, Position } from '../types/GameTypes';
import CanvasOverlay from './CanvasOverlay';

interface GameCanvasProps {
  gameState: GameState;
  playerId: string;
  onMove: (position: Position) => void;
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
const ASPECT_RATIO = GAME_WIDTH / GAME_HEIGHT;

interface KeyState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

// Add these constants for visual effects
const NIGHT_OVERLAY_OPACITY = 0.5;
const SAFE_ZONE_PULSE_SPEED = 0.002;
const RESOURCE_GLOW_INTENSITY = 0.3;


// Add these constants for enhanced visuals
const RESOURCE_PULSE_SPEED = 0.003;
const PLAYER_OUTLINE_WIDTH = 2;
const PLAYER_EYES_COLOR = '#FFFFFF';
const RESOURCE_ICONS = {
  food: '🍖',
  water: '💧',
  oxygen: '⭐'
};

// Add this interface for particle effects
interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  velocity: {
    x: number;
    y: number;
  };
}

// Add these constants
const PLAYER_BOUNCE_SPEED = 0.004;
const PLAYER_EYE_RADIUS = PLAYER_SIZE / 6;

// Add these constants at the top
const MIN_RESOURCE_SIZE = 8;
const MAX_RESOURCE_SIZE = 16;
const MAX_RESOURCE_AMOUNT = 100;

// Add these constants at the top with other constants
const JOYSTICK_SIZE = 80;
const JOYSTICK_INNER_SIZE = 40;
const JOYSTICK_DEAD_ZONE = 10;
const MOBILE_MOVEMENT_SPEED = 3;

// Add these constants
const DPAD_SIZE = 150;
const DPAD_BUTTON_SIZE = 50;
const DPAD_OPACITY = 0.4;

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

// Add this utility function
const vibrate = (pattern: number | number[]) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

// Use in various actions
const handleCollect = () => {
  vibrate(50); // Short vibration
  // Collection logic
};

const handleDanger = () => {
  vibrate([100, 50, 100]); // Pattern for danger
  // Danger logic
};

const GameCanvas = React.memo(({ gameState, playerId, onMove }: GameCanvasProps) => {
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
  const particlesRef = useRef<Particle[]>([]);

  // Memoize state updates
  const [overlayPosition, setOverlayPosition] = useState({ top: 0, right: 0 });
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
        } else {
          playersRef.current.set(player.id, {
            ...player,
            visualPosition: { ...player.position },
            targetPosition: { ...player.position },
            name: ''
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

  // Memoize render dependencies
  const renderDeps = useMemo(() => ({
    gameState,
    playerId,
    mousePos
  }), [gameState, playerId, mousePos]);

  // Move this function before the render function
  const processKeyboardMovement = useCallback(() => {
    const player = playersRef.current.get(playerId);
    if (!player) return;

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
      const newX = Math.max(0, Math.min(800, player.targetPosition.x + dx * KEYBOARD_SPEED));
      const newY = Math.max(0, Math.min(600, player.targetPosition.y + dy * KEYBOARD_SPEED));

      // Only send update if position has changed significantly
      if (!lastPositionRef.current ||
          getDistance(lastPositionRef.current, { x: newX, y: newY }) > 1) {
        
        // Update the target position immediately for smooth local movement
        player.targetPosition = { x: newX, y: newY };
        
        // Throttle network updates
        if (!moveTimeoutRef.current) {
          moveTimeoutRef.current = setTimeout(() => {
            onMove({ x: newX, y: newY });
            lastPositionRef.current = { x: newX, y: newY };
            moveTimeoutRef.current = null;
          }, 16); // Increase update frequency for more responsive movement
        }
      }
    }
  }, [playerId, onMove]);

  // The render function that uses processKeyboardMovement
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Clear with a single operation
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Batch similar operations
    ctx.save();
    
    // Draw background with gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    if (gameState.isDayTime) {
      bgGradient.addColorStop(0, '#87CEEB');
      bgGradient.addColorStop(1, '#90EE90');
    } else {
      bgGradient.addColorStop(0, '#1a1a2e');
      bgGradient.addColorStop(1, '#2F4F4F');
    }
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw safe zones
    gameState.safeZones.forEach(zone => {
      const pulseScale = Math.sin(Date.now() * SAFE_ZONE_PULSE_SPEED) * 0.1 + 1;
      
      // Draw outer glow
      const gradient = ctx.createRadialGradient(
        zone.position.x, zone.position.y, zone.radius * 0.8,
        zone.position.x, zone.position.y, zone.radius * pulseScale
      );
      gradient.addColorStop(0, 'rgba(255, 255, 0, 0.2)');
      gradient.addColorStop(1, 'rgba(255, 255, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(zone.position.x, zone.position.y, zone.radius * pulseScale, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw resources
    gameState.resources.forEach(resource => {
      const baseSize = MIN_RESOURCE_SIZE + 
        ((MAX_RESOURCE_SIZE - MIN_RESOURCE_SIZE) * (resource.amount / MAX_RESOURCE_AMOUNT));
      const pulse = Math.sin(Date.now() * RESOURCE_PULSE_SPEED) * 0.2 + 1;
      const size = baseSize * pulse;

      ctx.fillStyle = resource.type === 'food' ? '#FFD700' : 
                     resource.type === 'water' ? '#87CEFA' : '#F0FFFF';
      ctx.beginPath();
      ctx.arc(resource.position.x, resource.position.y, size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw only non-spectator players
    playersRef.current.forEach(player => {
      if (!player.isSpectator) { // Only render non-spectator players
        const { x, y } = player.visualPosition;
        const isMoving = x !== player.targetPosition.x || y !== player.targetPosition.y;
        const bounceOffset = isMoving ? Math.sin(Date.now() * PLAYER_BOUNCE_SPEED) * 2 : 0;

        // Draw player body
        ctx.fillStyle = player.id === playerId ? '#FF6B6B' : '#868E96';
        ctx.beginPath();
        ctx.arc(x, y + bounceOffset, PLAYER_SIZE, 0, Math.PI * 2);
        ctx.fill();

        // Draw player outline
        ctx.strokeStyle = player.isInSafeZone ? '#FFD700' : '#FFFFFF';
        ctx.lineWidth = PLAYER_OUTLINE_WIDTH;
        ctx.stroke();
      }
    });

    // Draw night overlay
    if (!gameState.isDayTime) {
      ctx.fillStyle = `rgba(0, 0, 20, ${NIGHT_OVERLAY_OPACITY})`;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    // Process movement and continue animation
    processKeyboardMovement();
    updatePositions();
    animationFrameRef.current = requestAnimationFrame(render);

    // Add particle effects here
    particlesRef.current = particlesRef.current.filter(particle => {
      particle.x += particle.velocity.x;
      particle.y += particle.velocity.y;
      particle.alpha -= 0.02;
      particle.life -= 0.02;

      if (particle.life > 0) {
        ctx.fillStyle = `${particle.color}${Math.floor(particle.alpha * 255).toString(16).padStart(2, '0')}`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        return true;
      }
      return false;
    });

    // Add ripple effects here
    gameState.safeZones.forEach(zone => {
      const rippleTime = Date.now() * 0.001;
      const rippleCount = 3;
      
      for (let i = 0; i < rippleCount; i++) {
        const ripplePhase = (rippleTime + i / rippleCount) % 1;
        const rippleRadius = zone.radius * (1 + ripplePhase * 0.2);
        const rippleAlpha = (1 - ripplePhase) * 0.2;

        ctx.strokeStyle = `rgba(255, 215, 0, ${rippleAlpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(zone.position.x, zone.position.y, rippleRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // Add joystick rendering to the render function, after drawing everything else but before ctx.restore()
    if (joystick.active) {
      // Draw joystick base
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.arc(joystick.startPosition.x, joystick.startPosition.y, JOYSTICK_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();

      // Calculate stick position with limit
      const dx = joystick.currentPosition.x - joystick.startPosition.x;
      const dy = joystick.currentPosition.y - joystick.startPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance = JOYSTICK_SIZE / 2;

      let stickX = joystick.startPosition.x;
      let stickY = joystick.startPosition.y;

      if (distance > 0) {
        const limitedDistance = Math.min(distance, maxDistance);
        stickX += (dx / distance) * limitedDistance;
        stickY += (dy / distance) * limitedDistance;
      }

      // Draw stick
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(stickX, stickY, JOYSTICK_INNER_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Add D-pad rendering
    if (!joystick.active) {
      // Draw D-pad
      ctx.save();
      ctx.globalAlpha = DPAD_OPACITY;
      
      // Position in bottom left corner
      const dpadX = DPAD_SIZE;
      const dpadY = GAME_HEIGHT - DPAD_SIZE;

      // Draw D-pad buttons
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      
      // Up button
      ctx.beginPath();
      ctx.arc(dpadX, dpadY - DPAD_BUTTON_SIZE, DPAD_BUTTON_SIZE/2, 0, Math.PI * 2);
      ctx.fill();
      
      // Down button
      ctx.beginPath();
      ctx.arc(dpadX, dpadY + DPAD_BUTTON_SIZE, DPAD_BUTTON_SIZE/2, 0, Math.PI * 2);
      ctx.fill();
      
      // Left button
      ctx.beginPath();
      ctx.arc(dpadX - DPAD_BUTTON_SIZE, dpadY, DPAD_BUTTON_SIZE/2, 0, Math.PI * 2);
      ctx.fill();
      
      // Right button
      ctx.beginPath();
      ctx.arc(dpadX + DPAD_BUTTON_SIZE, dpadY, DPAD_BUTTON_SIZE/2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();
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

  // Add this function to create particles
  const createCollectParticles = useCallback((x: number, y: number, color: string) => {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      particlesRef.current.push({
        x,
        y,
        size: 2,
        color,
        alpha: 1,
        life: 1,
        velocity: {
          x: Math.cos(angle) * 2,
          y: Math.sin(angle) * 2
        }
      });
    }
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

  // Use transition value for lighting
  const lightingColor = `rgba(0, 0, 20, ${(1 - dayNightTransitionRef.current) * NIGHT_OVERLAY_OPACITY})`;

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

  // Add these variables
  let touchStartTime = 0;
  let lastTapTime = 0;
  const DOUBLE_TAP_DELAY = 300;

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