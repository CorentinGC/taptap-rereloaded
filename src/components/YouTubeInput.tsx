"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isValidYouTubeUrl, extractVideoId } from "@/lib/utils/youtube";
import { useGameStore } from "@/stores/game-store";
import { LoadingScreen } from "./LoadingScreen";
import type { Difficulty } from "@/lib/game/types";
import { DIFFICULTY_CONFIGS } from "@/lib/utils/constants";

interface StepProgress {
  [stepId: string]: number;
}

const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];

export function YouTubeInput() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState("info");
  const [stepProgress, setStepProgress] = useState<StepProgress>({});
  const router = useRouter();
  const setBeatmap = useGameStore((s) => s.setBeatmap);
  const difficulty = useGameStore((s) => s.difficulty);
  const setDifficulty = useGameStore((s) => s.setDifficulty);

  const updateProgress = useCallback((step: string, percent: number) => {
    setStepProgress((prev) => ({ ...prev, [step]: percent }));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const trimmedUrl = url.trim();
    if (!trimmedUrl || !isValidYouTubeUrl(trimmedUrl)) {
      setError("URL YouTube invalide");
      return;
    }

    setLoading(true);
    setCurrentStep("info");
    setStepProgress({});

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmedUrl, difficulty }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de l'analyse");
      }

      if (!res.body) {
        throw new Error("Le navigateur ne supporte pas le streaming");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const match = line.match(/^data: (.+)$/m);
          if (!match) continue;

          const msg = JSON.parse(match[1]);

          if (msg.type === "step") {
            setCurrentStep(msg.step);
            updateProgress(msg.step, msg.percent ?? 0);
          } else if (msg.type === "progress") {
            updateProgress(msg.step, msg.percent);
          } else if (msg.type === "done") {
            setBeatmap(msg.beatmap);
            const videoId = extractVideoId(trimmedUrl);
            router.push(`/game?v=${videoId}`);
            return;
          } else if (msg.type === "error") {
            throw new Error(msg.error);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <LoadingScreen
        currentStep={currentStep}
        stepProgress={stepProgress}
        error={error || undefined}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
      {/* Difficulty selector */}
      <div className="flex gap-2 justify-center">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDifficulty(d)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              difficulty === d
                ? d === "easy"
                  ? "bg-green-600 text-white"
                  : d === "normal"
                  ? "bg-blue-600 text-white"
                  : "bg-red-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {DIFFICULTY_CONFIGS[d].label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
          className="flex-1 px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
        <button
          type="submit"
          className="px-6 py-3 rounded-lg bg-gradient-to-r from-red-500 to-blue-500 font-semibold hover:opacity-90 transition-opacity"
        >
          Jouer
        </button>
      </div>
      {error && <p className="text-red-400 text-sm text-center">{error}</p>}
    </form>
  );
}
