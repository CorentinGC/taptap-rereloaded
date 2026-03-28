import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface SongRow {
  videoId: string;
  title: string;
  duration: number;
  bpm: number;
  thumbnailUrl: string | null;
  createdAt: Date;
  beatmapEasy: unknown;
  beatmapNormal: unknown;
  beatmapHard: unknown;
}

export async function GET() {
  const songs: SongRow[] = await prisma.song.findMany({
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      videoId: true,
      title: true,
      duration: true,
      bpm: true,
      thumbnailUrl: true,
      createdAt: true,
      beatmapEasy: true,
      beatmapNormal: true,
      beatmapHard: true,
    },
  });

  const result = songs.map((s) => ({
    videoId: s.videoId,
    title: s.title,
    duration: s.duration,
    bpm: s.bpm,
    thumbnailUrl: s.thumbnailUrl,
    createdAt: s.createdAt,
    difficulties: {
      easy: s.beatmapEasy !== null,
      normal: s.beatmapNormal !== null,
      hard: s.beatmapHard !== null,
    },
  }));

  return NextResponse.json(result);
}
