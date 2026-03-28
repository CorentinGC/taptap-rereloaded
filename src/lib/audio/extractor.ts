import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { unlink, writeFile } from "fs/promises";
import { spawn } from "child_process";
import { execFile } from "child_process";
import { promisify } from "util";
import ffmpegPath from "ffmpeg-static";
import ytdl from "@distube/ytdl-core";

const execFileAsync = promisify(execFile);

// --- YouTube cookies helpers ---

function parseNetscapeCookies(raw: string): Array<{ name: string; value: string; domain: string; path: string; secure: boolean; expirationDate: number; httpOnly: boolean }> {
  return raw
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((line) => {
      const [domain, , path, secure, expires, name, value] = line.split("\t");
      return { domain, path, secure: secure === "TRUE", expirationDate: parseInt(expires, 10), httpOnly: false, name, value };
    })
    .filter((c) => c.name && c.value);
}

function getYtdlAgent(): ReturnType<typeof ytdl.createAgent> | undefined {
  const b64 = process.env.YOUTUBE_COOKIES_BASE64;
  if (!b64) return undefined;
  const raw = Buffer.from(b64, "base64").toString("utf-8");
  const cookies = parseNetscapeCookies(raw);
  return ytdl.createAgent(cookies);
}

let _cookieFilePath: string | undefined;

async function getCookieFilePath(): Promise<string | undefined> {
  const b64 = process.env.YOUTUBE_COOKIES_BASE64;
  if (!b64) return undefined;
  if (_cookieFilePath) return _cookieFilePath;
  const raw = Buffer.from(b64, "base64").toString("utf-8");
  const p = join(tmpdir(), `yt-cookies-${randomUUID()}.txt`);
  await writeFile(p, raw, "utf-8");
  _cookieFilePath = p;
  return p;
}

// Try yt-dlp first (local dev), fall back to ytdl-core (serverless)
async function downloadWithYtDlp(
  url: string,
  wavPath: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  const cookiePath = await getCookieFilePath();
  return new Promise<void>((resolve, reject) => {
    const args = [
      "-x",
      "--audio-format", "wav",
      "--postprocessor-args", `ffmpeg:-ar 22050 -ac 1 -acodec pcm_s16le`,
      "-o", wavPath,
      "--no-playlist",
      "--newline",
      ...(cookiePath ? ["--cookies", cookiePath] : []),
      url,
    ];
    const proc = spawn("yt-dlp", args);

    let lastPercent = 0;

    proc.stdout.on("data", (data: Buffer) => {
      const line = data.toString();
      const match = line.match(/\[download\]\s+([\d.]+)%/);
      if (match) {
        const pct = Math.min(Math.round(parseFloat(match[1])), 100);
        if (pct > lastPercent) {
          lastPercent = pct;
          onProgress?.(pct);
        }
      }
      if (line.includes("[ExtractAudio]") || line.includes("[PostProcess")) {
        onProgress?.(100);
      }
    });

    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`yt-dlp exited with code ${code}`));
    });

    proc.on("error", reject);

    setTimeout(() => {
      proc.kill();
      reject(new Error("yt-dlp timeout"));
    }, 120_000);
  });
}

async function downloadWithYtdlCore(
  url: string,
  wavPath: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  // Download audio to a temp file
  const tempAudio = wavPath.replace(".wav", ".webm");

  const agent = getYtdlAgent();
  const info = await ytdl.getInfo(url, { agent });
  const format = ytdl.chooseFormat(info.formats, {
    filter: "audioonly",
    quality: "lowestaudio",
  });

  const totalBytes = format.contentLength ? parseInt(format.contentLength, 10) : 0;
  let downloadedBytes = 0;

  const stream = ytdl.downloadFromInfo(info, {
    format,
    agent,
  });

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
    downloadedBytes += (chunk as Buffer).length;
    if (totalBytes > 0) {
      onProgress?.(Math.min(Math.round((downloadedBytes / totalBytes) * 90), 90));
    }
  }

  await writeFile(tempAudio, Buffer.concat(chunks));
  onProgress?.(92);

  // Convert to WAV using ffmpeg-static
  if (!ffmpegPath) throw new Error("ffmpeg-static not found");

  await execFileAsync(ffmpegPath, [
    "-i", tempAudio,
    "-ar", "22050",
    "-ac", "1",
    "-acodec", "pcm_s16le",
    "-y",
    wavPath,
  ], { timeout: 60_000 });

  await unlink(tempAudio).catch(() => {});
  onProgress?.(100);
}

async function isYtDlpAvailable(): Promise<boolean> {
  try {
    await execFileAsync("yt-dlp", ["--version"], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

export async function extractAudio(
  url: string,
  onProgress?: (percent: number) => void
): Promise<{ wavPath: string; cleanup: () => Promise<void> }> {
  const wavPath = join(tmpdir(), `taptap-${randomUUID()}.wav`);

  const hasYtDlp = await isYtDlpAvailable();

  if (hasYtDlp) {
    await downloadWithYtDlp(url, wavPath, onProgress);
  } else {
    await downloadWithYtdlCore(url, wavPath, onProgress);
  }

  return {
    wavPath,
    cleanup: () => unlink(wavPath).catch(() => {}),
  };
}

export async function getVideoInfo(url: string) {
  const hasYtDlp = await isYtDlpAvailable();

  if (hasYtDlp) {
    const cookiePath = await getCookieFilePath();
    const { stdout } = await execFileAsync(
      "yt-dlp",
      [
        "--print", "%(title)s\n%(duration)s\n%(id)s",
        "--no-playlist",
        ...(cookiePath ? ["--cookies", cookiePath] : []),
        url,
      ],
      { timeout: 30_000 }
    );
    const [title, durationStr, videoId] = stdout.trim().split("\n");
    return {
      title,
      duration: parseInt(durationStr, 10),
      videoId,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
  }

  // Fallback: ytdl-core
  const agent = getYtdlAgent();
  const info = await ytdl.getBasicInfo(url, { agent });
  const details = info.videoDetails;
  return {
    title: details.title,
    duration: parseInt(details.lengthSeconds, 10),
    videoId: details.videoId,
    thumbnailUrl:
      details.thumbnails?.[details.thumbnails.length - 1]?.url ??
      `https://img.youtube.com/vi/${details.videoId}/hqdefault.jpg`,
  };
}
