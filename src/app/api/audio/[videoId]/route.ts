import { prisma } from "@/lib/db";
import { head } from "@vercel/blob";

export async function GET(
  request: Request,
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
    const blobInfo = await head(song.audioUrl);
    const token = process.env.BLOB_READ_WRITE_TOKEN;

    // Forward Range header for proper audio streaming
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const rangeHeader = request.headers.get("Range");
    if (rangeHeader) headers["Range"] = rangeHeader;

    const res = await fetch(song.audioUrl, { headers });

    if (!res.ok && res.status !== 206) {
      return new Response("Audio not available", { status: 502 });
    }

    const responseHeaders: Record<string, string> = {
      "Content-Type": blobInfo.contentType ?? "audio/ogg",
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
    };

    // Forward range response headers
    const contentRange = res.headers.get("Content-Range");
    if (contentRange) responseHeaders["Content-Range"] = contentRange;

    const contentLength = res.headers.get("Content-Length");
    if (contentLength) responseHeaders["Content-Length"] = contentLength;

    return new Response(res.body, {
      status: res.status, // 200 or 206
      headers: responseHeaders,
    });
  } catch (err) {
    console.error("Audio proxy error:", err);
    return new Response("Audio not available", { status: 500 });
  }
}
