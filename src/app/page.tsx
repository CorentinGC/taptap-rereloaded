import { YouTubeInput } from "@/components/YouTubeInput";
import { SongList } from "@/components/SongList";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center min-h-screen px-4 py-16">
      <div className="flex flex-col items-center gap-8 max-w-lg w-full">
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-red-500 via-blue-500 to-green-500 bg-clip-text text-transparent">
            Tap Tap Beats
          </h1>
          <p className="text-zinc-400 text-lg text-center">
            Colle un lien YouTube et joue au rythme de la musique
          </p>
        </div>

        <YouTubeInput />

        <div className="flex gap-8 text-sm text-zinc-500 mt-4">
          <div className="flex flex-col items-center gap-1">
            <div className="flex gap-1">
              {["D", "F", "J", "K"].map((key) => (
                <kbd
                  key={key}
                  className="w-8 h-8 flex items-center justify-center rounded bg-zinc-800 border border-zinc-700 text-xs font-mono"
                >
                  {key}
                </kbd>
              ))}
            </div>
            <span>Touches de jeu</span>
          </div>
        </div>

        <SongList />
      </div>
    </div>
  );
}
