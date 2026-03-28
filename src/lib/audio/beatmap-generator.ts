import type { OnsetData } from "./analyzer";
import type { Beatmap, Note, Difficulty } from "@/lib/game/types";
import { LANE_COUNT, MIN_NOTE_GAP, DIFFICULTY_CONFIGS } from "@/lib/utils/constants";

export function generateBeatmap(
  videoId: string,
  duration: number,
  bpm: number,
  onsets: OnsetData[],
  difficulty: Difficulty = "normal"
): Beatmap {
  const config = DIFFICULTY_CONFIGS[difficulty];

  // Filter onsets based on difficulty note percentage
  const sorted = [...onsets].sort((a, b) => b.intensity - a.intensity);
  const cutoff = Math.floor(sorted.length * config.notePercentage);
  const intensityThreshold = sorted[cutoff]?.intensity ?? 0;

  const filtered = onsets.filter((o) => o.intensity >= intensityThreshold);

  // Generate notes with lane assignment
  const notes: Note[] = [];
  let lastLane = -1;
  let sweepDir = 1;

  for (let i = 0; i < filtered.length; i++) {
    const onset = filtered[i];

    if (notes.length > 0) {
      const prev = notes[notes.length - 1];
      if (onset.time - prev.time < MIN_NOTE_GAP) continue;
    }

    let lane: number;

    if (onset.intensity > 0.8 && i > 0) {
      lane = Math.random() > 0.5 ? 1 : 2;
    } else {
      const gap = i > 0 ? onset.time - filtered[i - 1].time : 1;
      if (gap < 0.3) {
        lane = lastLane + sweepDir;
        if (lane >= LANE_COUNT || lane < 0) {
          sweepDir *= -1;
          lane = lastLane + sweepDir;
        }
      } else {
        do {
          lane = Math.floor(Math.random() * LANE_COUNT);
        } while (lane === lastLane && LANE_COUNT > 1);
      }
    }

    lane = Math.max(0, Math.min(LANE_COUNT - 1, lane));
    lastLane = lane;

    notes.push({
      id: `n-${i}`,
      time: onset.time,
      lane,
      intensity: onset.intensity,
    });
  }

  return { videoId, duration, bpm, difficulty, notes };
}
