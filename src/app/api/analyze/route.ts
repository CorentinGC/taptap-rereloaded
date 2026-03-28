import { extractAudio, getVideoInfo } from "@/lib/audio/extractor";
import { analyzeAudio } from "@/lib/audio/analyzer";
import { generateBeatmap } from "@/lib/audio/beatmap-generator";
import { isValidYouTubeUrl, extractVideoId } from "@/lib/utils/youtube";
import { prisma } from "@/lib/db";
import type { Difficulty } from "@/lib/game/types";

export const maxDuration = 120;

const BEATMAP_COLUMN: Record<Difficulty, "beatmapEasy" | "beatmapNormal" | "beatmapHard"> = {
  easy: "beatmapEasy",
  normal: "beatmapNormal",
  hard: "beatmapHard",
};

export async function POST(request: Request) {
  try {
    const { url, difficulty = "normal" } = await request.json();

    if (!url || !isValidYouTubeUrl(url)) {
      return new Response(
        JSON.stringify({ error: "URL YouTube invalide" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: "Impossible d'extraire l'ID vidéo" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const column = BEATMAP_COLUMN[difficulty as Difficulty] ?? "beatmapNormal";

    // Check cache
    const cached = await prisma.song.findUnique({ where: { videoId } });
    if (cached && cached[column]) {
      // Return cached beatmap immediately via SSE
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "step", step: "cache", percent: 100 })}\n\n`
            )
          );
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "done", beatmap: cached[column] })}\n\n`
            )
          );
          controller.close();
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function send(data: Record<string, unknown>) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        }

        function sendStep(step: string, percent = 0) {
          send({ type: "step", step, percent });
        }

        function sendProgress(step: string, percent: number) {
          send({ type: "progress", step, percent });
        }

        try {
          sendStep("info", 0);
          const info = await getVideoInfo(url);
          sendProgress("info", 100);

          sendStep("download", 0);
          const { wavPath, cleanup } = await extractAudio(url, (pct) => {
            sendProgress("download", pct);
          });

          try {
            sendStep("analyze", 0);
            const { bpm, onsets } = analyzeAudio(wavPath, (pct) => {
              sendProgress("analyze", pct);
            });

            sendStep("beatmap", 0);
            const beatmap = generateBeatmap(
              info.videoId,
              info.duration,
              bpm,
              onsets,
              difficulty as Difficulty
            );
            sendProgress("beatmap", 100);

            // Save to database
            try {
              await prisma.song.upsert({
                where: { videoId: info.videoId },
                update: {
                  [column]: beatmap as unknown as Record<string, unknown>,
                  bpm,
                },
                create: {
                  videoId: info.videoId,
                  url,
                  title: info.title,
                  duration: info.duration,
                  bpm,
                  thumbnailUrl: info.thumbnailUrl,
                  [column]: beatmap as unknown as Record<string, unknown>,
                },
              });
            } catch (dbError) {
              console.error("DB save error (non-blocking):", dbError);
            }

            send({ type: "done", beatmap });
          } finally {
            await cleanup();
          }
        } catch (error) {
          send({
            type: "error",
            error:
              error instanceof Error ? error.message : "Erreur d'analyse",
          });
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Analyze error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erreur d'analyse",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
