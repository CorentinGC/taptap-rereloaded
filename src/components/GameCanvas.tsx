"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { GameEngine } from "@/lib/game/engine";
import { useGameStore } from "@/stores/game-store";
import type { VideoPlayerRef } from "./VideoPlayer";
import { VideoPlayer } from "./VideoPlayer";
import { ScoreDisplay } from "./ScoreDisplay";
import { LANE_KEYS } from "@/lib/utils/constants";

interface GameCanvasProps {
  videoId: string;
}

export function GameCanvas({ videoId }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<VideoPlayerRef>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const router = useRouter();

  const beatmap = useGameStore((s) => s.beatmap);
  const difficulty = useGameStore((s) => s.difficulty);
  const updateScore = useGameStore((s) => s.updateScore);
  const setStatus = useGameStore((s) => s.setStatus);
  const setCurrentTime = useGameStore((s) => s.setCurrentTime);

  const handleEnd = useCallback(() => {
    setStatus("ended");
    router.push("/results");
  }, [setStatus, router]);

  // Detect touch device
  useEffect(() => {
    setIsTouchDevice("ontouchstart" in window);
  }, []);

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
  }, []);

  // Start countdown when player is ready
  useEffect(() => {
    if (!ready || !beatmap) return;

    setStatus("countdown");
    setCountdown(3);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setPlaying(true);
          setStatus("playing");
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [ready, beatmap, setStatus]);

  // Initialize game engine when playing starts
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !beatmap || !playing) return;

    const engine = new GameEngine(
      canvas,
      beatmap,
      () => playerRef.current?.getCurrentTime() ?? 0,
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

  if (!beatmap) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-zinc-400">Aucune beatmap chargée</p>
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

      <VideoPlayer
        ref={playerRef}
        videoId={videoId}
        playing={playing}
        onReady={() => setReady(true)}
        onEnded={handleEnd}
      />

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
