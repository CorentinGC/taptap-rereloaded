"use client";

import { useGameStore } from "@/stores/game-store";
import { calculateAccuracy, calculateGrade } from "@/lib/game/scoring";
import Link from "next/link";

const GRADE_COLORS: Record<string, string> = {
  S: "text-yellow-400",
  A: "text-green-400",
  B: "text-blue-400",
  C: "text-orange-400",
  D: "text-red-400",
};

export function ResultsCard() {
  const { score, maxCombo, hits } = useGameStore((s) => s.gameState);
  const beatmap = useGameStore((s) => s.beatmap);
  const accuracy = calculateAccuracy(hits);
  const grade = calculateGrade(accuracy);
  const totalNotes = hits.perfect + hits.good + hits.miss;

  return (
    <div className="flex flex-col items-center gap-8 max-w-md w-full mx-auto p-8 rounded-2xl bg-zinc-900 border border-zinc-800">
      {/* Grade */}
      <div className={`text-9xl font-bold ${GRADE_COLORS[grade]}`}>
        {grade}
      </div>

      {/* Score */}
      <div className="text-4xl font-bold tabular-nums">
        {score.toLocaleString()}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 w-full text-center">
        <div className="p-3 rounded-lg bg-zinc-800">
          <div className="text-2xl font-bold text-yellow-400">{hits.perfect}</div>
          <div className="text-xs text-zinc-500">Perfect</div>
        </div>
        <div className="p-3 rounded-lg bg-zinc-800">
          <div className="text-2xl font-bold text-green-400">{hits.good}</div>
          <div className="text-xs text-zinc-500">Good</div>
        </div>
        <div className="p-3 rounded-lg bg-zinc-800">
          <div className="text-2xl font-bold text-red-400">{hits.miss}</div>
          <div className="text-xs text-zinc-500">Miss</div>
        </div>
        <div className="p-3 rounded-lg bg-zinc-800">
          <div className="text-2xl font-bold">{maxCombo}</div>
          <div className="text-xs text-zinc-500">Max Combo</div>
        </div>
      </div>

      {/* Accuracy */}
      <div className="text-lg text-zinc-400">
        Précision : <span className="text-white font-semibold">{accuracy.toFixed(1)}%</span>
        {" · "}
        {totalNotes} notes
      </div>

      {/* BPM */}
      {beatmap && (
        <div className="text-sm text-zinc-500">{beatmap.bpm} BPM</div>
      )}

      {/* Actions */}
      <div className="flex gap-4 w-full">
        {beatmap && (
          <Link
            href={`/game?v=${beatmap.videoId}`}
            className="flex-1 py-3 text-center rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors font-medium"
          >
            Rejouer
          </Link>
        )}
        <Link
          href="/"
          className="flex-1 py-3 text-center rounded-lg bg-zinc-700 hover:bg-zinc-600 transition-colors font-medium"
        >
          Nouveau morceau
        </Link>
      </div>
    </div>
  );
}
