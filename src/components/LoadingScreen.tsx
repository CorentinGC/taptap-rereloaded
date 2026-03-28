"use client";

const STEPS = [
  { id: "info", label: "Récupération des infos vidéo" },
  { id: "download", label: "Extraction de l'audio" },
  { id: "analyze", label: "Analyse des beats" },
  { id: "beatmap", label: "Génération de la beatmap" },
];

interface LoadingScreenProps {
  currentStep: string;
  stepProgress: Record<string, number>;
  error?: string;
}

export function LoadingScreen({
  currentStep,
  stepProgress,
  error,
}: LoadingScreenProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-sm">
      {/* Spinner */}
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-zinc-700" />
        <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin" />
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-1.5 w-full">
        {STEPS.map((step, i) => {
          const isActive = step.id === currentStep;
          const isDone = i < currentIndex;
          const isPending = i > currentIndex;
          const percent = isDone ? 100 : (stepProgress[step.id] ?? 0);

          return (
            <div
              key={step.id}
              className={`flex flex-col gap-1.5 px-4 py-2.5 rounded-lg transition-all duration-300 ${
                isActive
                  ? "bg-zinc-800 border border-zinc-600"
                  : isDone
                  ? "bg-zinc-900/50"
                  : ""
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Step indicator */}
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                  {isDone ? (
                    <svg
                      className="w-5 h-5 text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : isActive ? (
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-zinc-600" />
                  )}
                </div>

                {/* Label + percent */}
                <span
                  className={`flex-1 text-sm transition-colors duration-300 ${
                    isActive
                      ? "text-white font-medium"
                      : isDone
                      ? "text-zinc-500"
                      : isPending
                      ? "text-zinc-600"
                      : ""
                  }`}
                >
                  {step.label}
                </span>

                {/* Percentage */}
                {(isActive || isDone) && (
                  <span
                    className={`text-xs font-mono tabular-nums ${
                      isDone ? "text-green-400" : "text-zinc-400"
                    }`}
                  >
                    {percent}%
                  </span>
                )}
              </div>

              {/* Progress bar (only for active step) */}
              {isActive && (
                <div className="ml-9 h-1 rounded-full bg-zinc-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-300 ease-out"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <p className="text-red-400 text-sm text-center px-4">{error}</p>
      )}

      {/* Subtitle */}
      {!error && (
        <p className="text-xs text-zinc-600">
          Cela peut prendre jusqu&apos;à 30 secondes...
        </p>
      )}
    </div>
  );
}
