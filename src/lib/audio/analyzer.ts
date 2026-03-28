import { readFileSync } from "fs";
import { SAMPLE_RATE, FFT_SIZE, HOP_SIZE, MIN_NOTE_GAP } from "@/lib/utils/constants";

export interface OnsetData {
  time: number;
  intensity: number;
}

export interface AnalysisResult {
  bpm: number;
  onsets: OnsetData[];
}

function decodeWav(buffer: Buffer): Float32Array {
  const dataStart = 44;
  const samples = new Float32Array((buffer.length - dataStart) / 2);
  for (let i = 0; i < samples.length; i++) {
    const offset = dataStart + i * 2;
    const sample = buffer.readInt16LE(offset);
    samples[i] = sample / 32768;
  }
  return samples;
}

// Cooley-Tukey FFT (radix-2, in-place)
function fft(real: Float32Array, imag: Float32Array) {
  const n = real.length;
  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      let tmp = real[i]; real[i] = real[j]; real[j] = tmp;
      tmp = imag[i]; imag[i] = imag[j]; imag[j] = tmp;
    }
  }
  // FFT butterfly
  for (let len = 2; len <= n; len *= 2) {
    const halfLen = len / 2;
    const angle = -2 * Math.PI / len;
    const wReal = Math.cos(angle);
    const wImag = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let curReal = 1, curImag = 0;
      for (let j = 0; j < halfLen; j++) {
        const a = i + j;
        const b = a + halfLen;
        const tReal = curReal * real[b] - curImag * imag[b];
        const tImag = curReal * imag[b] + curImag * real[b];
        real[b] = real[a] - tReal;
        imag[b] = imag[a] - tImag;
        real[a] += tReal;
        imag[a] += tImag;
        const nextReal = curReal * wReal - curImag * wImag;
        curImag = curReal * wImag + curImag * wReal;
        curReal = nextReal;
      }
    }
  }
}

// Pre-compute Hann window
const hannWindow = new Float32Array(FFT_SIZE);
for (let i = 0; i < FFT_SIZE; i++) {
  hannWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
}

function computeSpectralFlux(
  samples: Float32Array,
  onProgress?: (percent: number) => void
): number[] {
  const fluxValues: number[] = [];
  let prevMagnitudes: Float32Array | null = null;
  const totalFrames = Math.floor((samples.length - FFT_SIZE) / HOP_SIZE) + 1;
  let frameIndex = 0;
  let lastReportedPct = 0;

  // Reusable buffers
  const real = new Float32Array(FFT_SIZE);
  const imag = new Float32Array(FFT_SIZE);
  const magnitudes = new Float32Array(FFT_SIZE / 2);

  for (let i = 0; i + FFT_SIZE <= samples.length; i += HOP_SIZE) {
    // Apply Hann window + copy to real, zero imag
    for (let j = 0; j < FFT_SIZE; j++) {
      real[j] = samples[i + j] * hannWindow[j];
      imag[j] = 0;
    }

    // FFT
    fft(real, imag);

    // Compute magnitudes
    for (let k = 0; k < FFT_SIZE / 2; k++) {
      magnitudes[k] = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
    }

    if (prevMagnitudes) {
      let flux = 0;
      for (let k = 0; k < magnitudes.length; k++) {
        const diff = magnitudes[k] - prevMagnitudes[k];
        if (diff > 0) flux += diff;
      }
      fluxValues.push(flux);
    } else {
      fluxValues.push(0);
    }

    // Copy magnitudes for next frame comparison
    if (!prevMagnitudes) prevMagnitudes = new Float32Array(FFT_SIZE / 2);
    prevMagnitudes.set(magnitudes);

    frameIndex++;
    const pct = Math.round((frameIndex / totalFrames) * 100);
    if (pct >= lastReportedPct + 5) {
      lastReportedPct = pct;
      onProgress?.(Math.min(pct, 100));
    }
  }

  return fluxValues;
}

function detectBPM(samples: Float32Array): number {
  const windowSize = SAMPLE_RATE * 4;
  const slice = samples.subarray(0, Math.min(windowSize * 3, samples.length));

  const envHop = 512;
  const envelopeLen = Math.floor(slice.length / envHop);
  const envelope = new Float64Array(envelopeLen);
  for (let i = 0; i < envelopeLen; i++) {
    const off = i * envHop;
    let energy = 0;
    for (let j = 0; j < envHop && off + j < slice.length; j++) {
      energy += slice[off + j] * slice[off + j];
    }
    envelope[i] = energy / envHop;
  }

  const minLag = Math.floor((60 / 200) * (SAMPLE_RATE / envHop));
  const maxLag = Math.floor((60 / 60) * (SAMPLE_RATE / envHop));
  let bestLag = minLag;
  let bestCorr = -Infinity;

  for (let lag = minLag; lag <= Math.min(maxLag, envelope.length / 2); lag++) {
    let corr = 0;
    for (let i = 0; i < envelope.length - lag; i++) {
      corr += envelope[i] * envelope[i + lag];
    }
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  const bpm = 60 / (bestLag * (envHop / SAMPLE_RATE));
  return Math.max(60, Math.min(200, Math.round(bpm)));
}

function adaptiveThreshold(
  values: number[],
  windowSize: number,
  multiplier: number
): boolean[] {
  const n = values.length;
  const half = Math.floor(windowSize / 2);
  const result = new Array<boolean>(n);

  // Sliding window: maintain running sum and sum of squares
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  // Initialize window for index 0
  const initEnd = Math.min(half, n);
  for (let j = 0; j < initEnd; j++) {
    sum += values[j];
    sumSq += values[j] * values[j];
    count++;
  }

  for (let i = 0; i < n; i++) {
    // Expand window right
    const addIdx = i + half;
    if (addIdx < n && addIdx >= initEnd) {
      sum += values[addIdx];
      sumSq += values[addIdx] * values[addIdx];
      count++;
    }
    // Shrink window left
    const removeIdx = i - half - 1;
    if (removeIdx >= 0) {
      sum -= values[removeIdx];
      sumSq -= values[removeIdx] * values[removeIdx];
      count--;
    }

    const mean = sum / count;
    const variance = sumSq / count - mean * mean;
    const stddev = Math.sqrt(Math.max(0, variance));
    result[i] = values[i] > mean + multiplier * stddev;
  }

  return result;
}

export function analyzeAudio(
  wavPath: string,
  onProgress?: (percent: number) => void
): AnalysisResult {
  const buffer = readFileSync(wavPath);
  const samples = decodeWav(buffer);

  onProgress?.(5);
  const bpm = detectBPM(samples);
  onProgress?.(10);

  // Spectral flux with FFT (the heavy part)
  const flux = computeSpectralFlux(samples, (pct) => {
    onProgress?.(10 + Math.round(pct * 0.8));
  });

  onProgress?.(92);
  const thresholdWindow = Math.floor((2.3 * SAMPLE_RATE) / HOP_SIZE);
  const aboveThreshold = adaptiveThreshold(flux, thresholdWindow, 1.5);

  const minGapFrames = Math.floor((MIN_NOTE_GAP * SAMPLE_RATE) / HOP_SIZE);
  const onsets: OnsetData[] = [];
  let lastOnsetFrame = -minGapFrames;

  // Find max flux without spread operator (avoids stack overflow on large arrays)
  let maxFlux = 1;
  for (let i = 0; i < flux.length; i++) {
    if (flux[i] > maxFlux) maxFlux = flux[i];
  }

  for (let i = 1; i < flux.length - 1; i++) {
    if (
      aboveThreshold[i] &&
      flux[i] > flux[i - 1] &&
      flux[i] >= flux[i + 1] &&
      i - lastOnsetFrame >= minGapFrames
    ) {
      const time = (i * HOP_SIZE) / SAMPLE_RATE;
      onsets.push({
        time,
        intensity: Math.min(flux[i] / maxFlux, 1),
      });
      lastOnsetFrame = i;
    }
  }

  onProgress?.(96);

  const beatDuration = 60 / bpm;
  const subdivision = beatDuration / 2;

  const quantized = onsets.map((onset) => {
    const nearestBeat = Math.round(onset.time / subdivision) * subdivision;
    const distance = Math.abs(onset.time - nearestBeat);
    return {
      ...onset,
      time: distance < subdivision * 0.4 ? nearestBeat : onset.time,
    };
  });

  onProgress?.(100);
  return { bpm, onsets: quantized };
}
