import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { unlink, writeFile } from "fs/promises";
import { spawn } from "child_process";
import { execFile } from "child_process";
import { promisify } from "util";
import ffmpegPath from "ffmpeg-static";
import Innertube from "youtubei.js";

const execFileAsync = promisify(execFile);

// --- YouTube cookies helpers ---

function getNetscapeCookieString(): string | undefined {
  const b64 = process.env.YOUTUBE_COOKIES_BASE64;
  if (!b64) return undefined;
  return Buffer.from(b64, "base64").toString("utf-8");
}

/** Convert Netscape cookie file to "name=value; name2=value2" header format */
function netscapeToCookieHeader(raw: string): string {
  return raw
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((line) => {
      const parts = line.split("\t");
      if (parts.length >= 7) return `${parts[5]}=${parts[6]}`;
      return null;
    })
    .filter(Boolean)
    .join("; ");
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

let _innertube: Innertube | undefined;

async function getInnertube(): Promise<Innertube> {
  if (_innertube) return _innertube;
  const raw = getNetscapeCookieString();
  const cookie = raw ? netscapeToCookieHeader(raw) : undefined;
  _innertube = await Innertube.create({ cookie });
  return _innertube;
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

// --- youtubei.js (serverless / fallback) ---

async function downloadWithYoutubei(
  url: string,
  wavPath: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  const yt = await getInnertube();
  const videoId = extractVideoIdFromUrl(url);

  onProgress?.(5);

  const stream = await yt.download(videoId, { type: "audio", quality: "best", client: "ANDROID" });

  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  let done = false;
  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (result.value) chunks.push(result.value);
  }

  const tempAudio = wavPath.replace(".wav", ".webm");
  await writeFile(tempAudio, Buffer.concat(chunks));
  onProgress?.(80);

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

function extractVideoIdFromUrl(url: string): string {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/|music\.youtube\.com\/watch\?v=)([\w-]{11})/
  );
  if (!match) throw new Error(`Invalid YouTube URL: ${url}`);
  return match[1];
}

// --- Public API ---

export async function extractAudio(
  url: string,
  onProgress?: (percent: number) => void
): Promise<{ wavPath: string; cleanup: () => Promise<void> }> {
  const wavPath = join(tmpdir(), `taptap-${randomUUID()}.wav`);

  const hasYtDlp = await isYtDlpAvailable();

  if (hasYtDlp) {
    await downloadWithYtDlp(url, wavPath, onProgress);
  } else {
    await downloadWithYoutubei(url, wavPath, onProgress);
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

  // Fallback: youtubei.js
  const yt = await getInnertube();
  const videoId = extractVideoIdFromUrl(url);
  const info = await yt.getBasicInfo(videoId, { client: "ANDROID" });
  const details = info.basic_info;
  return {
    title: details.title ?? "Unknown",
    duration: details.duration ?? 0,
    videoId: details.id ?? videoId,
    thumbnailUrl:
      details.thumbnail?.[details.thumbnail.length - 1]?.url ??
      `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };
}
