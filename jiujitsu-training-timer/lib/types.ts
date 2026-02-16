export interface Position {
  id: number;
  name: string;
  category: 'guard' | 'top' | 'bottom' | 'neutral';
  color: string;
}

export interface TimerSettings {
  roundDuration: number; // in seconds
  numberOfRounds: number;
  restDuration: number; // in seconds
}

export interface SessionState {
  currentRound: number;
  isActive: boolean;
  isPaused: boolean;
  timeRemaining: number; // in seconds
  selectedPosition: Position | null;
  positionsHistory: Position[];
  sessionStartTime: Date | null;
}

export interface RoundConfig {
  duration: number; // in seconds
  position: Position | null;
}

export interface TrainingPlan {
  id: string;
  name: string;
  rounds: RoundConfig[];
  restDuration: number; // in seconds between rounds
}

