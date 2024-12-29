export interface Position {
  x: number;
  y: number;
}

export interface Resource {
  id: string;
  type: 'food' | 'water' | 'oxygen';
  position: Position;
  amount: number;
}

export interface SafeZone {
  id: string;
  position: Position;
  radius: number;
}

export interface Player {
  id: string;
  position: Position;
  resources: {
    food: number;
    water: number;
    oxygen: number;
  };
  score: number;
  isInSafeZone: boolean;
}

export interface PlayerVisual extends Player {
  visualPosition: Position; // Position for rendering
  targetPosition: Position; // Position to move towards
}

export interface GameState {
  players: Player[];
  resources: Resource[];
  safeZones: SafeZone[];
  isDayTime: boolean;
  timeRemaining: number;
  gameStatus: 'waiting' | 'running' | 'finished';
} 