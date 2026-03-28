"use client";

import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { GameEngine } from "@/lib/game/engine";
import { useGameStore } from "@/stores/game-store";
import type { Beatmap } from "@/lib/game/types";
import { ScoreDisplay } from "./ScoreDisplay";
import { LANE_KEYS } from "@/lib/utils/constants";

function getIsTouchDevice() {
  return typeof window !== "undefined" && "ontouchstart" in window;
}

const subscribe = () => () => {};

interface GameCanvasProps {
  videoId: string;
  difficulty: string;
}

export function GameCanvas({ videoId, difficulty: difficultyParam }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadingBeatmap, setLoadingBeatmap] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const isTouchDevice = useSyncExternalStore(subscribe, getIsTouchDevice, () => false);
  const router = useRouter();

  const difficulty = (difficultyParam || "normal") as import("@/lib/game/types").Difficulty;
  const updateScore = useGameStore((s) => s.updateScore);
  const setStatus = useGameStore((s) => s.setStatus);
  const setCurrentTime = useGameStore((s) => s.setCurrentTime);

  const [beatmap, setBeatmap] = useState<Beatmap | null>(null);

  // Fetch beatmap + audioUrl from API
  useEffect(() => {
    let cancelled = false;
    async function fetchBeatmap() {
      try {
        const res = await fetch(`/api/songs/${videoId}?difficulty=${difficulty}`);
        if (!res.ok) {
          if (!cancelled) setError("Beatmap non trouvée. Retourne à l'accueil pour analyser la chanson.");
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setBeatmap(data.beatmap);
          setAudioUrl(data.audioUrl);
        }
      } catch {
        if (!cancelled) setError("Impossible de charger la beatmap");
      } finally {
        if (!cancelled) setLoadingBeatmap(false);
      }
    }

    fetchBeatmap();
    return () => { cancelled = true; };
  }, [videoId, difficulty]);

  const handleEnd = useCallback(() => {
    setStatus("ended");
    router.push("/results");
  }, [setStatus, router]);

  // Initialize canvas sizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
      engineRef.current?.resize(canvas!.width, canvas!.height);
    }

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [beatmap]);

  // Audio ready → start countdown
  useEffect(() => {
    if (!ready || !beatmap) return;

    let count = 3;
    setCountdown(count);
    setStatus("countdown");

    const interval = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(interval);
        setCountdown(null);
        // Start audio and engine together
        audioRef.current?.play();
        setPlaying(true);
        setStatus("playing");
      } else {
        setCountdown(count);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [ready, beatmap, setStatus]);

  // Initialize game engine when playing starts
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !beatmap || !playing) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const engine = new GameEngine(
      canvas,
      beatmap,
      () => audioRef.current?.currentTime ?? 0,
      {
        onScoreUpdate: updateScore,
        onTimeUpdate: setCurrentTime,
        onEnd: handleEnd,
      },
      difficulty
    );

    engineRef.current = engine;
    engine.start();

    return () => engine.destroy();
  }, [playing, beatmap, difficulty, updateScore, setCurrentTime, handleEnd]);

  if (loadingBeatmap) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-zinc-400">Chargement de la beatmap...</p>
      </div>
    );
  }

  if (error || !beatmap) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-zinc-400">{error ?? "Aucune beatmap chargée"}</p>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
        >
          Retour à l'accueil
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0a0a]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ touchAction: "none" }}
      />

      {/* Hidden audio player */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="auto"
          onCanPlayThrough={() => setReady(true)}
          onEnded={handleEnd}
        />
      )}
      {!audioUrl && !loadingBeatmap && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-red-900/80 px-4 py-2 rounded text-sm">
          Audio non disponible
        </div>
      )}

      <ScoreDisplay />

      {/* Lane key hints (desktop only) */}
      {!isTouchDevice && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-16 z-10">
          {LANE_KEYS.map((key) => (
            <kbd
              key={key}
              className="w-10 h-10 flex items-center justify-center rounded bg-zinc-800/50 border border-zinc-700/50 text-sm font-mono text-zinc-500"
            >
              {key.toUpperCase()}
            </kbd>
          ))}
        </div>
      )}

      {/* Countdown overlay */}
      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/60">
          <span className="text-8xl font-bold text-white animate-ping">
            {countdown}
          </span>
        </div>
      )}
    </div>
  );
}
