import type { Grade, HitCounts } from "./types";

export function calculateAccuracy(hits: HitCounts): number {
  const total = hits.perfect + hits.good + hits.miss;
  if (total === 0) return 0;
  return ((hits.perfect * 1.0 + hits.good * 0.5) / total) * 100;
}

export function calculateGrade(accuracy: number): Grade {
  if (accuracy >= 95) return "S";
  if (accuracy >= 90) return "A";
  if (accuracy >= 80) return "B";
  if (accuracy >= 70) return "C";
  return "D";
}
