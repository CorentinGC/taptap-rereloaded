export type Difficulty = 'easy' | 'normal' | 'hard' | 'expert';

export interface DifficultyConfig {
  notePercentage: number;
  perfectWindow: number;
  goodWindow: number;
  label: string;
}

export interface Note {
  id: string;
  time: number;
  lane: number;
  intensity: number;
}

export interface Beatmap {
  videoId: string;
  duration: number;
  bpm: number;
  difficulty: Difficulty;
  notes: Note[];
}

export type HitGrade = 'perfect' | 'good' | 'miss';

export interface HitCounts {
  perfect: number;
  good: number;
  miss: number;
}

export interface GameState {
  status: 'idle' | 'countdown' | 'playing' | 'paused' | 'ended';
  score: number;
  combo: number;
  maxCombo: number;
  hits: HitCounts;
  currentTime: number;
}

export interface ActiveNote extends Note {
  y: number;
  hit: boolean;
  missed: boolean;
}

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface HitEffect {
  x: number;
  y: number;
  grade: HitGrade;
  time: number;
  alpha: number;
}
