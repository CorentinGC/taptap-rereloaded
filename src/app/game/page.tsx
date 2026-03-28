import { GameCanvas } from "@/components/GameCanvas";

interface GamePageProps {
  searchParams: Promise<{ v?: string }>;
}

export default async function GamePage({ searchParams }: GamePageProps) {
  const params = await searchParams;
  const videoId = params.v;

  if (!videoId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-zinc-400">Aucune vidéo sélectionnée</p>
      </div>
    );
  }

  return <GameCanvas videoId={videoId} />;
}
