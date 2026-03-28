"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useGameStore } from "@/stores/game-store";
import type { Difficulty } from "@/lib/game/types";
import { DIFFICULTY_CONFIGS } from "@/lib/utils/constants";

interface SongEntry {
  videoId: string;
  title: string;
  duration: number;
  bpm: number;
  thumbnailUrl: string | null;
  difficulties: Record<Difficulty, boolean>;
}

const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard", "expert"];

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: "bg-green-900/40 text-green-400",
  normal: "bg-blue-900/40 text-blue-400",
  hard: "bg-red-900/40 text-red-400",
  expert: "bg-purple-900/40 text-purple-400",
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SongList() {
  const [songs, setSongs] = useState<SongEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSong, setSelectedSong] = useState<SongEntry | null>(null);
  const router = useRouter();
  const setDifficulty = useGameStore((s) => s.setDifficulty);

  useEffect(() => {
    fetch("/api/songs")
      .then((r) => r.json())
      .then(setSongs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function selectSong(song: SongEntry) {
    setSelectedSong(song);
  }

  function playWithDifficulty(d: Difficulty) {
    if (!selectedSong) return;
    setDifficulty(d);
    router.push(`/game?v=${selectedSong.videoId}&d=${d}`);
  }

  if (loading) return null;
  if (songs.length === 0) return null;

  // Difficulty picker for selected song
  if (selectedSong) {
    return (
      <div className="flex flex-col items-center gap-6 w-full mt-8">
        <div className="flex items-center gap-4">
          {selectedSong.thumbnailUrl && (
            <Image
              src={selectedSong.thumbnailUrl}
              alt=""
              width={80}
              height={45}
              className="rounded"
              unoptimized
            />
          )}
          <div>
            <p className="text-sm font-medium">{selectedSong.title}</p>
            <p className="text-xs text-zinc-500">{selectedSong.bpm} BPM</p>
          </div>
        </div>
        <h3 className="text-lg font-semibold">Choisis ta difficulté</h3>
        <div className="flex flex-wrap gap-3 justify-center">
          {DIFFICULTIES.filter((d) => selectedSong.difficulties[d]).map((d) => (
            <button
              key={d}
              onClick={() => playWithDifficulty(d)}
              className={`px-6 py-3 rounded-lg text-base font-medium text-white transition-all hover:opacity-90 ${
                d === "easy" ? "bg-green-600" : d === "normal" ? "bg-blue-600" : d === "hard" ? "bg-red-600" : "bg-purple-600"
              }`}
            >
              {DIFFICULTY_CONFIGS[d].label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSelectedSong(null)}
          className="text-sm text-zinc-500 hover:text-zinc-300"
        >
          Retour
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full mt-8">
      <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
        Chansons récentes
      </h2>
      <div className="grid gap-3">
        {songs.map((song) => (
          <button
            key={song.videoId}
            onClick={() => selectSong(song)}
            className="flex items-center gap-4 p-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-colors text-left"
          >
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
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{song.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-zinc-500">
                  {formatDuration(song.duration)}
                </span>
                <span className="text-xs text-zinc-500">{song.bpm} BPM</span>
                <div className="flex gap-1 ml-auto">
                  {DIFFICULTIES.map(
                    (d) =>
                      song.difficulties[d] && (
                        <span
                          key={d}
                          className={`text-[10px] px-1.5 py-0.5 rounded ${DIFFICULTY_COLORS[d]}`}
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
