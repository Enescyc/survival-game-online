import { useEffect, useRef, useCallback, useState } from 'react';
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
const PLAYER_TRAIL_LENGTH = 5;

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
const PLAYER_DIRECTION_SPEED = 0.1;
const PLAYER_BOUNCE_SPEED = 0.004;
const PLAYER_EYE_RADIUS = PLAYER_SIZE / 6;

// Add these constants at the top
const MIN_RESOURCE_SIZE = 8;
const MAX_RESOURCE_SIZE = 16;
const MAX_RESOURCE_AMOUNT = 100;

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
}

const GameCanvas = ({ gameState, playerId, onMove }: GameCanvasProps) => {
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

  // Add state for overlay position
  const [overlayPosition, setOverlayPosition] = useState({ top: 0, right: 0 });

  // Add state for particles
  const particlesRef = useRef<Particle[]>([]);

  // Add transition state
  const dayNightTransitionRef = useRef(gameState.isDayTime ? 1 : 0);

  // Add mouse position state
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

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

  // Update visual positions
  const updatePositions = useCallback(() => {
    playersRef.current.forEach(player => {
      if (player.visualPosition.x !== player.targetPosition.x || 
          player.visualPosition.y !== player.targetPosition.y) {
        
        const dx = player.targetPosition.x - player.visualPosition.x;
        const dy = player.targetPosition.y - player.visualPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < POSITION_THRESHOLD) {
          // Snap to target if very close
          player.visualPosition.x = player.targetPosition.x;
          player.visualPosition.y = player.targetPosition.y;
        } else {
          // Smooth movement
          player.visualPosition.x = lerp(player.visualPosition.x, player.targetPosition.x, MOVEMENT_SPEED);
          player.visualPosition.y = lerp(player.visualPosition.y, player.targetPosition.y, MOVEMENT_SPEED);
        }
      }
    });
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

  // Add keyboard movement processing
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

  // Render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw background with gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    if (gameState.isDayTime) {
      bgGradient.addColorStop(0, '#87CEEB'); // Sky blue
      bgGradient.addColorStop(1, '#90EE90'); // Light green
    } else {
      bgGradient.addColorStop(0, '#1a1a2e'); // Dark blue
      bgGradient.addColorStop(1, '#2F4F4F'); // Dark green
    }
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw grid pattern
    ctx.strokeStyle = gameState.isDayTime ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = 0; x < GAME_WIDTH; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, GAME_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < GAME_HEIGHT; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(GAME_WIDTH, y);
      ctx.stroke();
    }

    // Draw safe zones with pulsing effect
    const pulseScale = Math.sin(Date.now() * SAFE_ZONE_PULSE_SPEED) * 0.1 + 1;
    gameState.safeZones.forEach(zone => {
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

      // Draw safe zone boundary
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(zone.position.x, zone.position.y, zone.radius, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Draw resources with enhanced visuals
    gameState.resources.forEach(resource => {
      // Calculate size based on resource amount
      const baseSize = MIN_RESOURCE_SIZE + 
        ((MAX_RESOURCE_SIZE - MIN_RESOURCE_SIZE) * (resource.amount / MAX_RESOURCE_AMOUNT));
      
      // Resource pulse effect
      const pulse = Math.sin(Date.now() * RESOURCE_PULSE_SPEED) * 0.2 + 1;
      const size = baseSize * pulse;

      const player = playersRef.current.get(playerId);
      if (player) {
        const distance = Math.sqrt(
          Math.pow(player.visualPosition.x - resource.position.x, 2) +
          Math.pow(player.visualPosition.y - resource.position.y, 2)
        );

        // Enhanced resource glow with size-based radius
        if (distance <= 50) {
          const glowSize = Math.max(0, 1 - distance / 50) * RESOURCE_GLOW_INTENSITY;
          const glow = ctx.createRadialGradient(
            resource.position.x, resource.position.y, 0,
            resource.position.x, resource.position.y, size * 4
          );
          
          // Type-specific glow colors
          const glowColors = {
            food: `rgba(255, 179, 71, ${glowSize})`,
            water: `rgba(135, 206, 250, ${glowSize})`,
            oxygen: `rgba(240, 255, 255, ${glowSize})`
          };
          
          glow.addColorStop(0, glowColors[resource.type]);
          glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(resource.position.x, resource.position.y, size * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw resource base with enhanced gradients
      const resourceGradient = ctx.createRadialGradient(
        resource.position.x, resource.position.y - size/4, size/4,
        resource.position.x, resource.position.y + size/2, size * 1.2
      );

      switch (resource.type) {
        case 'food':
          resourceGradient.addColorStop(0, '#FFD700');
          resourceGradient.addColorStop(0.5, '#FFB347');
          resourceGradient.addColorStop(1, '#8B4513');
          break;
        case 'water':
          resourceGradient.addColorStop(0, '#E0FFFF');
          resourceGradient.addColorStop(0.5, '#87CEFA');
          resourceGradient.addColorStop(1, '#4169E1');
          break;
        case 'oxygen':
          resourceGradient.addColorStop(0, '#FFFFFF');
          resourceGradient.addColorStop(0.5, '#F0FFFF');
          resourceGradient.addColorStop(1, '#B0E0E6');
          break;
      }

      // Draw resource with shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = resourceGradient;
      ctx.beginPath();
      ctx.arc(resource.position.x, resource.position.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      // Draw resource icon
      ctx.font = `${size * 1.2}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        RESOURCE_ICONS[resource.type],
        resource.position.x,
        resource.position.y
      );

      // Add hover effect
      const hoverDistance = getDistance(
        mousePos,
        resource.position
      );

      if (hoverDistance < size * 2) {
        // Draw hover ring
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(resource.position.x, resource.position.y, size * 1.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw resource info tooltip
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(mousePos.x + 10, mousePos.y - 20, 120, 30);
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.fillText(
          `${resource.type}: +${resource.amount} (${Math.round((resource.amount / MAX_RESOURCE_AMOUNT) * 100)}%)`,
          mousePos.x + 15,
          mousePos.y
        );
      }
    });

    // Draw players with enhanced visuals
    playersRef.current.forEach(player => {
      const { x, y } = player.visualPosition;
      const isMoving = x !== player.targetPosition.x || y !== player.targetPosition.y;
      const bounceOffset = isMoving ? Math.sin(Date.now() * PLAYER_BOUNCE_SPEED) * 2 : 0;
      const adjustedY = y + bounceOffset;

      // Draw shadow at adjusted position
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(
        x, adjustedY + PLAYER_SIZE - 2,
        PLAYER_SIZE * 0.7,
        PLAYER_SIZE * 0.2,
        0, 0, Math.PI * 2
      );
      ctx.fill();

      // Draw body at adjusted position
      const playerGradient = ctx.createRadialGradient(
        x, adjustedY - PLAYER_SIZE/3, 0,
        x, adjustedY, PLAYER_SIZE
      );

      if (player.id === playerId) {
        playerGradient.addColorStop(0, '#FFA07A');
        playerGradient.addColorStop(0.6, '#FF6B6B');
        playerGradient.addColorStop(1, '#C92A2A');
      } else {
        playerGradient.addColorStop(0, '#A9A9A9');
        playerGradient.addColorStop(0.6, '#868E96');
        playerGradient.addColorStop(1, '#495057');
      }

      // Draw body
      ctx.fillStyle = playerGradient;
      ctx.beginPath();
      ctx.arc(x, y, PLAYER_SIZE, 0, Math.PI * 2);
      ctx.fill();

      // Draw outline
      ctx.strokeStyle = player.isInSafeZone ? '#FFD700' : '#FFFFFF';
      ctx.lineWidth = PLAYER_OUTLINE_WIDTH;
      ctx.stroke();

      // Calculate direction for eyes
      const dx = player.targetPosition.x - x;
      const dy = player.targetPosition.y - y;
      const angle = Math.atan2(dy, dx);
      
      // Draw player with direction
      const eyeOffset = PLAYER_SIZE / 3;
      const eyeY = adjustedY - PLAYER_SIZE / 4;
      const pupilOffset = PLAYER_EYE_RADIUS / 2;
      const pupilX = Math.cos(angle) * pupilOffset;
      const pupilY = Math.sin(angle) * pupilOffset;

      // Eye whites with direction
      ctx.fillStyle = PLAYER_EYES_COLOR;
      ctx.beginPath();
      ctx.arc(x - eyeOffset, eyeY, PLAYER_EYE_RADIUS, 0, Math.PI * 2);
      ctx.arc(x + eyeOffset, eyeY, PLAYER_EYE_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Pupils that follow movement direction
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(x - eyeOffset + pupilX, eyeY + pupilY, PLAYER_EYE_RADIUS/2, 0, Math.PI * 2);
      ctx.arc(x + eyeOffset + pupilX, eyeY + pupilY, PLAYER_EYE_RADIUS/2, 0, Math.PI * 2);
      ctx.fill();

      // Draw player glow in safe zone
      if (player.isInSafeZone) {
        const safeGlow = ctx.createRadialGradient(
          x, y, PLAYER_SIZE,
          x, y, PLAYER_SIZE * 2
        );
        safeGlow.addColorStop(0, 'rgba(255, 215, 0, 0.2)');
        safeGlow.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = safeGlow;
        ctx.beginPath();
        ctx.arc(x, y, PLAYER_SIZE * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw player name
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'white';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 3;
      ctx.strokeText(player.name, x, y + PLAYER_SIZE + 5);
      ctx.fillText(player.name, x, y + PLAYER_SIZE + 5);
    });

    // Update transition in render
    const transitionSpeed = 0.05;
    if (gameState.isDayTime && dayNightTransitionRef.current < 1) {
      dayNightTransitionRef.current = Math.min(1, dayNightTransitionRef.current + transitionSpeed);
    } else if (!gameState.isDayTime && dayNightTransitionRef.current > 0) {
      dayNightTransitionRef.current = Math.max(0, dayNightTransitionRef.current - transitionSpeed);
    }

    // Use transition value for lighting
    ctx.fillStyle = `rgba(0, 0, 20, ${(1 - dayNightTransitionRef.current) * NIGHT_OVERLAY_OPACITY})`;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Process keyboard movement and continue animation
    processKeyboardMovement();
    updatePositions();
    animationFrameRef.current = requestAnimationFrame(render);

    // Move particle update inside render function
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

    // Draw safe zones with pulsing effect
    gameState.safeZones.forEach(zone => {
      // Add ripple effect
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
  }, [gameState, playerId, updatePositions, processKeyboardMovement, mousePos]);

  // Update players map when gameState changes
  useEffect(() => {
    gameState.players.forEach(player => {
      const existingPlayer = playersRef.current.get(player.id);
      if (existingPlayer) {
        // Update target position
        existingPlayer.targetPosition = player.position;
        // Update other properties
        existingPlayer.resources = player.resources;
        existingPlayer.score = player.score;
        existingPlayer.isInSafeZone = player.isInSafeZone;
      } else {
        // Create new player with visual position
        playersRef.current.set(player.id, {
          ...player,
          visualPosition: { ...player.position },
          targetPosition: { ...player.position },
          name: ''
        });
      }
    });

    // Remove disconnected players
    Array.from(playersRef.current.keys()).forEach(id => {
      if (!gameState.players.find(p => p.id === id)) {
        playersRef.current.delete(id);
      }
    });
  }, [gameState.players]);

  // Start/stop animation loop
  useEffect(() => {
    render();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [render]);

  // Add resize handler
  const handleResize = useCallback(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;

    // Get container dimensions
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const containerRatio = containerWidth / containerHeight;

    let newWidth;
    let newHeight;

    if (containerRatio > ASPECT_RATIO) {
      // Container is wider than game ratio
      newHeight = containerHeight;
      newWidth = containerHeight * ASPECT_RATIO;
    } else {
      // Container is taller than game ratio
      newWidth = containerWidth;
      newHeight = containerWidth / ASPECT_RATIO;
    }

    // Update canvas style dimensions
    canvas.style.width = `${newWidth}px`;
    canvas.style.height = `${newHeight}px`;

    // Calculate scale factor
    scaleRef.current = newWidth / GAME_WIDTH;

    // Calculate canvas position
    const rect = canvas.getBoundingClientRect();
    setOverlayPosition({
      top: rect.top,
      right: window.innerWidth - rect.right
    });
  }, []);

  // Add resize effect
  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Update click handler to account for scaling
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scale = scaleRef.current;
    
    // Convert clicked coordinates to game coordinates
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    
    onMove({ x, y });

    const player = playersRef.current.get(playerId);
    if (player) {
      player.targetPosition = { x, y };
    }
  };

  // Add helper function for distance calculation
  const getDistance = (pos1: Position, pos2: Position): number => {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full min-h-[600px] flex items-center justify-center bg-gray-900 relative"
    >
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          className="border border-gray-300 max-w-full max-h-full"
          style={{ imageRendering: 'pixelated' }}
        />
        {gameState.players.map(player => (
          player.id === playerId && (
            <CanvasOverlay 
              key={player.id} 
              player={player}
              position={overlayPosition}
              scale={scaleRef.current}
              isDayTime={gameState.isDayTime}
            />
          )
        ))}
      </div>
    </div>
  );
};

export default GameCanvas; 