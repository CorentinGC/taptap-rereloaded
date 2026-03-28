import { prisma } from "@/lib/db";
import { getDownloadUrl } from "@vercel/blob";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params;

  const song = await prisma.song.findUnique({
    where: { videoId },
    select: { audioUrl: true },
  });

  if (!song?.audioUrl) {
    return new Response("Audio not found", { status: 404 });
  }

  // For private blobs, get a temporary download URL and redirect
  try {
    const downloadUrl = await getDownloadUrl(song.audioUrl);
    return Response.redirect(downloadUrl, 302);
  } catch {
    // Fallback: proxy the blob directly
    const res = await fetch(song.audioUrl, {
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
      },
    });

    if (!res.ok) {
      return new Response("Audio not available", { status: 502 });
    }

    return new Response(res.body, {
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "audio/ogg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }
}
