import type { Difficulty, DifficultyConfig } from "@/lib/game/types";

export const LANE_COUNT = 4;
export const SCROLL_TIME = 2.0;
export const HIT_LINE_POSITION = 0.85;
export const PERFECT_WINDOW = 0.05;
export const GOOD_WINDOW = 0.12;
export const LANE_COLORS = ['#FF4444', '#4488FF', '#44DD44', '#FFAA00'];
export const LANE_KEYS = ['d', 'f', 'j', 'k'];
export const POINTS = { perfect: 300, good: 100, miss: 0 } as const;
export const COMBO_MULTIPLIER_CAP = 2.0;
export const MIN_NOTE_GAP = 0.15;
export const SAMPLE_RATE = 22050;
export const FFT_SIZE = 1024;
export const HOP_SIZE = 512;

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  easy: {
    notePercentage: 0.4,
    perfectWindow: 0.07,
    goodWindow: 0.16,
    label: "Facile",
  },
  normal: {
    notePercentage: 0.65,
    perfectWindow: 0.05,
    goodWindow: 0.12,
    label: "Normal",
  },
  hard: {
    notePercentage: 0.9,
    perfectWindow: 0.035,
    goodWindow: 0.08,
    label: "Difficile",
  },
  expert: {
    notePercentage: 1.0,
    perfectWindow: 0.025,
    goodWindow: 0.06,
    label: "Expert",
  },
};
