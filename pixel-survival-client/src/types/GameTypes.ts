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
  name: string;
  position: Position;
  resources: {
    food: number;
    water: number;
    oxygen: number;
  };
  score: number;
  isInSafeZone: boolean;
  isSpectator: boolean;
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
  winner?: Player;
  finalScores?: {
    id: string;
    name: string;
    score: number;
  }[];
}

export interface PreparationPhaseData {
  message: string;
  timeRemaining: number;
}

export interface GameFinishedData {
  winner: Player;
  finalScores: {
    id: string;
    name: string;
    score: number;
  }[];
}

export interface LeaderboardEntry {
  playerName: string;
  score: number;
} 