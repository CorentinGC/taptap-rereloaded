"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useGameStore } from "@/stores/game-store";
import type { Difficulty, Beatmap } from "@/lib/game/types";
import { DIFFICULTY_CONFIGS } from "@/lib/utils/constants";

interface SongEntry {
  videoId: string;
  title: string;
  duration: number;
  bpm: number;
  thumbnailUrl: string | null;
  difficulties: Record<Difficulty, boolean>;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SongList() {
  const [songs, setSongs] = useState<SongEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const setBeatmap = useGameStore((s) => s.setBeatmap);
  const difficulty = useGameStore((s) => s.difficulty);
  const setDifficulty = useGameStore((s) => s.setDifficulty);

  useEffect(() => {
    fetch("/api/songs")
      .then((r) => r.json())
      .then(setSongs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function playSong(song: SongEntry) {
    // Pick best available difficulty
    let selectedDifficulty = difficulty;
    if (!song.difficulties[selectedDifficulty]) {
      const available = (["normal", "easy", "hard"] as Difficulty[]).find(
        (d) => song.difficulties[d]
      );
      if (!available) return;
      selectedDifficulty = available;
      setDifficulty(selectedDifficulty);
    }

    try {
      const res = await fetch(
        `/api/songs/${song.videoId}?difficulty=${selectedDifficulty}`
      );
      if (!res.ok) return;
      const beatmap: Beatmap = await res.json();
      setBeatmap(beatmap);
      router.push(`/game?v=${song.videoId}`);
    } catch {
      // Ignore
    }
  }

  if (loading) return null;
  if (songs.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 w-full mt-8">
      <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
        Chansons récentes
      </h2>
      <div className="grid gap-3">
        {songs.map((song) => (
          <button
            key={song.videoId}
            onClick={() => playSong(song)}
            className="flex items-center gap-4 p-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-colors text-left"
          >
            {/* Thumbnail */}
            <div className="w-20 h-12 rounded overflow-hidden flex-shrink-0 bg-zinc-800">
              {song.thumbnailUrl && (
                <Image
                  src={song.thumbnailUrl}
                  alt=""
                  width={160}
                  height={90}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{song.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-zinc-500">
                  {formatDuration(song.duration)}
                </span>
                <span className="text-xs text-zinc-500">{song.bpm} BPM</span>
                {/* Difficulty badges */}
                <div className="flex gap-1 ml-auto">
                  {(["easy", "normal", "hard"] as Difficulty[]).map(
                    (d) =>
                      song.difficulties[d] && (
                        <span
                          key={d}
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            d === "easy"
                              ? "bg-green-900/40 text-green-400"
                              : d === "normal"
                              ? "bg-blue-900/40 text-blue-400"
                              : "bg-red-900/40 text-red-400"
                          }`}
                        >
                          {DIFFICULTY_CONFIGS[d].label}
                        </span>
                      )
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
