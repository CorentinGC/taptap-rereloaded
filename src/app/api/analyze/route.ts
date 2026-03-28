import { extractAudio, getVideoInfo } from "@/lib/audio/extractor";
import { analyzeAudio } from "@/lib/audio/analyzer";
import { generateBeatmap } from "@/lib/audio/beatmap-generator";
import { isValidYouTubeUrl, extractVideoId } from "@/lib/utils/youtube";
import { prisma } from "@/lib/db";
import { put } from "@vercel/blob";
import { readFile } from "fs/promises";
import type { Difficulty, Beatmap } from "@/lib/game/types";

export const maxDuration = 120;

const ALL_DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard", "expert"];

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

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

    // Check cache
    let cached: Awaited<ReturnType<typeof prisma.song.findUnique>> = null;
    try {
      cached = await prisma.song.findUnique({ where: { videoId } });
    } catch (dbError) {
      console.error("DB cache lookup failed (non-blocking):", dbError);
    }

    if (cached && cached.beatmapNormal && cached.audioUrl) {
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
              `data: ${JSON.stringify({ type: "done", videoId, audioUrl: cached.audioUrl })}\n\n`
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
          const { wavPath, audioPath, audioContentType, cleanup } = await extractAudio(url, (pct) => {
            sendProgress("download", pct);
          });

          try {
            sendStep("analyze", 0);
            const { bpm, onsets } = analyzeAudio(wavPath, (pct) => {
              sendProgress("analyze", pct);
            });

            // Generate ALL difficulties
            sendStep("beatmap", 0);
            const beatmaps: Record<string, Beatmap> = {};
            for (const diff of ALL_DIFFICULTIES) {
              beatmaps[diff] = generateBeatmap(
                info.videoId,
                info.duration,
                bpm,
                onsets,
                diff
              );
            }
            sendProgress("beatmap", 100);

            // Upload MP3 to Vercel Blob
            sendStep("upload", 0);
            let audioUrl: string | null = null;
            try {
              const audioBuffer = await readFile(audioPath);
              const ext = audioContentType === "audio/webm" ? "webm" : "ogg";
              const blob = await put(`audio/${info.videoId}.${ext}`, audioBuffer, {
                access: "public",
                contentType: audioContentType,
                addRandomSuffix: false,
              });
              audioUrl = blob.url;
            } catch (uploadError) {
              console.error("Blob upload error (non-blocking):", uploadError);
            }
            sendProgress("upload", 100);

            // Save to database
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const toJson = (v: unknown) => v as any;
            try {
              await prisma.song.upsert({
                where: { videoId: info.videoId },
                update: {
                  beatmapEasy: toJson(beatmaps.easy),
                  beatmapNormal: toJson(beatmaps.normal),
                  beatmapHard: toJson(beatmaps.hard),
                  beatmapExpert: toJson(beatmaps.expert),
                  audioUrl,
                  bpm,
                },
                create: {
                  videoId: info.videoId,
                  url,
                  title: info.title,
                  duration: info.duration,
                  bpm,
                  thumbnailUrl: info.thumbnailUrl,
                  audioUrl,
                  beatmapEasy: toJson(beatmaps.easy),
                  beatmapNormal: toJson(beatmaps.normal),
                  beatmapHard: toJson(beatmaps.hard),
                  beatmapExpert: toJson(beatmaps.expert),
                },
              });
            } catch (dbError) {
              console.error("DB save error (non-blocking):", dbError);
            }

            send({ type: "done", videoId: info.videoId, audioUrl });
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
