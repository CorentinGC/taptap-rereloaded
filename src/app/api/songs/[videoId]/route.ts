import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Difficulty } from "@/lib/game/types";

const BEATMAP_COLUMN: Record<Difficulty, "beatmapEasy" | "beatmapNormal" | "beatmapHard"> = {
  easy: "beatmapEasy",
  normal: "beatmapNormal",
  hard: "beatmapHard",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params;
  const { searchParams } = new URL(request.url);
  const difficulty = (searchParams.get("difficulty") ?? "normal") as Difficulty;
  const column = BEATMAP_COLUMN[difficulty] ?? "beatmapNormal";

  const song = await prisma.song.findUnique({
    where: { videoId },
  });

  if (!song || !song[column]) {
    return NextResponse.json(
      { error: "Beatmap non trouvée" },
      { status: 404 }
    );
  }

  return NextResponse.json(song[column]);
}
