"use client";

import { useGameStore } from "@/stores/game-store";

export function ScoreDisplay() {
  const { score, combo, hits } = useGameStore((s) => s.gameState);

  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
      <div className="text-3xl font-bold tabular-nums">
        {score.toLocaleString()}
      </div>
      {combo > 0 && (
        <div
          className={`text-lg font-semibold ${
            combo >= 20
              ? "text-yellow-400"
              : combo >= 10
              ? "text-green-400"
              : "text-zinc-300"
          }`}
        >
          {combo}x combo
        </div>
      )}
      <div className="flex gap-3 text-xs text-zinc-500">
        <span className="text-yellow-400">{hits.perfect}</span>
        <span className="text-green-400">{hits.good}</span>
        <span className="text-red-400">{hits.miss}</span>
      </div>
    </div>
  );
}
