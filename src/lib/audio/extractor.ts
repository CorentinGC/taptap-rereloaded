import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { unlink, writeFile } from "fs/promises";
import { spawn } from "child_process";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// Resolve ffmpeg path at runtime to avoid Turbopack path mangling
function getFfmpegPath(): string | null {
  try {
    const modulePath = join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg");
    const { existsSync } = require("fs") as typeof import("fs");
    if (existsSync(modulePath)) return modulePath;
    const { execSync } = require("child_process") as typeof import("child_process");
    return execSync("which ffmpeg", { encoding: "utf-8" }).trim() || null;
  } catch {
    return null;
  }
}

// --- YouTube cookies helpers ---

function getNetscapeCookieString(): string | undefined {
  const b64 = process.env.YOUTUBE_COOKIES_BASE64;
  if (!b64) return undefined;
  return Buffer.from(b64, "base64").toString("utf-8");
}

let _cookieFilePath: string | undefined;

async function getCookieFilePath(): Promise<string | undefined> {
  const raw = getNetscapeCookieString();
  if (!raw) return undefined;
  if (_cookieFilePath) return _cookieFilePath;
  const p = join(tmpdir(), `yt-cookies-${randomUUID()}.txt`);
  await writeFile(p, raw, "utf-8");
  _cookieFilePath = p;
  return p;
}

// --- Railway yt-dlp service ---

const YTDLP_API_URL = process.env.YTDLP_API_URL; // e.g. https://ytdlp-api-production.up.railway.app
const YTDLP_API_SECRET = process.env.YTDLP_API_SECRET;

async function downloadWithRailway(
  url: string,
  wavPath: string,
  rawAudioPath: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  if (!YTDLP_API_URL) throw new Error("YTDLP_API_URL not configured");

  onProgress?.(5);

  const res = await fetch(`${YTDLP_API_URL}/download`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(YTDLP_API_SECRET ? { Authorization: `Bearer ${YTDLP_API_SECRET}` } : {}),
    },
    body: JSON.stringify({
      url,
      cookies_b64: process.env.YOUTUBE_COOKIES_BASE64 ?? "",
      format: "ogg",
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(`Railway yt-dlp failed: ${err.error || res.statusText}`);
  }

  onProgress?.(70);

  // Save the audio file
  const contentType = res.headers.get("Content-Type") ?? "audio/ogg";
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(rawAudioPath, buffer);

  onProgress?.(80);

  // Convert to WAV for analysis
  const ffmpeg = getFfmpegPath();
  if (!ffmpeg) throw new Error("ffmpeg-static not found");

  await execFileAsync(ffmpeg, [
    "-i", rawAudioPath,
    "-ar", "22050",
    "-ac", "1",
    "-acodec", "pcm_s16le",
    "-y",
    wavPath,
  ], { timeout: 60_000 });

  onProgress?.(100);
  return contentType;
}

async function getVideoInfoFromRailway(url: string) {
  if (!YTDLP_API_URL) throw new Error("YTDLP_API_URL not configured");

  const res = await fetch(`${YTDLP_API_URL}/info`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(YTDLP_API_SECRET ? { Authorization: `Bearer ${YTDLP_API_SECRET}` } : {}),
    },
    body: JSON.stringify({
      url,
      cookies_b64: process.env.YOUTUBE_COOKIES_BASE64 ?? "",
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(`Railway info failed: ${err.error || res.statusText}`);
  }

  return await res.json();
}

// --- yt-dlp (local dev only) ---

async function isYtDlpAvailable(): Promise<boolean> {
  try {
    await execFileAsync("yt-dlp", ["--version"], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

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

// --- Public API ---

export async function extractAudio(
  url: string,
  onProgress?: (percent: number) => void
): Promise<{ wavPath: string; audioPath: string; audioContentType: string; cleanup: () => Promise<void> }> {
  const id = randomUUID();
  const wavPath = join(tmpdir(), `taptap-${id}.wav`);
  const rawAudioPath = join(tmpdir(), `taptap-${id}.ogg`);

  const hasYtDlp = await isYtDlpAvailable();

  if (hasYtDlp) {
    // Local dev: use yt-dlp directly
    await downloadWithYtDlp(url, wavPath, onProgress);
    // Convert WAV to OGG for blob upload
    const ffmpeg = getFfmpegPath();
    if (ffmpeg) {
      try {
        await execFileAsync(ffmpeg, [
          "-i", wavPath,
          "-ar", "44100",
          "-codec:a", "libvorbis",
          "-b:a", "128k",
          "-y",
          rawAudioPath,
        ], { timeout: 60_000 });
      } catch (err) {
        console.error("FFmpeg OGG conversion failed:", err);
      }
    }
    return {
      wavPath,
      audioPath: rawAudioPath,
      audioContentType: "audio/ogg",
      cleanup: async () => {
        await unlink(wavPath).catch(() => {});
        await unlink(rawAudioPath).catch(() => {});
      },
    };
  }

  // Serverless: use Railway yt-dlp service
  const contentType = await downloadWithRailway(url, wavPath, rawAudioPath, onProgress);
  return {
    wavPath,
    audioPath: rawAudioPath,
    audioContentType: contentType,
    cleanup: async () => {
      await unlink(wavPath).catch(() => {});
      await unlink(rawAudioPath).catch(() => {});
    },
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

  // Serverless: use Railway
  return await getVideoInfoFromRailway(url);
}
