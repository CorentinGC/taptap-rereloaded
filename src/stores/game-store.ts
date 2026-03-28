import { create } from "zustand";
import type { Beatmap, GameState, HitGrade, Difficulty } from "@/lib/game/types";
import { POINTS, COMBO_MULTIPLIER_CAP } from "@/lib/utils/constants";

interface GameStore {
  beatmap: Beatmap | null;
  difficulty: Difficulty;
  setBeatmap: (bm: Beatmap) => void;
  setDifficulty: (d: Difficulty) => void;
  gameState: GameState;
  updateScore: (grade: HitGrade) => void;
  resetGame: () => void;
  setStatus: (status: GameState["status"]) => void;
  setCurrentTime: (time: number) => void;
}

const initialState: GameState = {
  status: "idle",
  score: 0,
  combo: 0,
  maxCombo: 0,
  hits: { perfect: 0, good: 0, miss: 0 },
  currentTime: 0,
};

export const useGameStore = create<GameStore>((set) => ({
  beatmap: null,
  difficulty: "normal",
  setBeatmap: (bm) => set({ beatmap: bm }),
  setDifficulty: (d) => set({ difficulty: d }),
  gameState: { ...initialState },

  updateScore: (grade) =>
    set((state) => {
      const gs = state.gameState;
      if (grade === "miss") {
        return {
          gameState: {
            ...gs,
            combo: 0,
            hits: { ...gs.hits, miss: gs.hits.miss + 1 },
          },
        };
      }

      const newCombo = gs.combo + 1;
      const multiplier = Math.min(1 + newCombo * 0.1, COMBO_MULTIPLIER_CAP);
      const points = Math.round(POINTS[grade] * multiplier);

      return {
        gameState: {
          ...gs,
          score: gs.score + points,
          combo: newCombo,
          maxCombo: Math.max(gs.maxCombo, newCombo),
          hits: { ...gs.hits, [grade]: gs.hits[grade] + 1 },
        },
      };
    }),

  resetGame: () => set({ gameState: { ...initialState } }),

  setStatus: (status) =>
    set((state) => ({ gameState: { ...state.gameState, status } })),

  setCurrentTime: (time) =>
    set((state) => ({ gameState: { ...state.gameState, currentTime: time } })),
}));
