import { prisma } from "@/lib/db";
import { head } from "@vercel/blob";

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

  try {
    // Get blob metadata
    const blobInfo = await head(song.audioUrl);

    // Fetch with token for private blobs
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const res = await fetch(song.audioUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) {
      console.error("Blob fetch failed:", res.status, await res.text());
      return new Response("Audio not available", { status: 502 });
    }

    return new Response(res.body, {
      headers: {
        "Content-Type": blobInfo.contentType ?? "audio/ogg",
        "Content-Length": String(blobInfo.size),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Accept-Ranges": "bytes",
      },
    });
  } catch (err) {
    console.error("Audio proxy error:", err);
    return new Response("Audio not available", { status: 500 });
  }
}
