import type { ActiveNote, HitEffect } from "./types";
import { LANE_COUNT, LANE_COLORS, HIT_LINE_POSITION } from "@/lib/utils/constants";

export class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private effects: HitEffect[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.width = canvas.width;
    this.height = canvas.height;
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  addEffect(effect: HitEffect) {
    this.effects.push(effect);
  }

  render(activeNotes: ActiveNote[]) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const laneWidth = w / LANE_COUNT;
    const hitY = h * HIT_LINE_POSITION;

    // Clear
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, w, h);

    // Lane dividers
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let i = 1; i < LANE_COUNT; i++) {
      const x = i * laneWidth;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Hit zone glow
    const gradient = ctx.createLinearGradient(0, hitY - 20, 0, hitY + 20);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.5, "rgba(255,255,255,0.15)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, hitY - 20, w, 40);

    // Hit line
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, hitY);
    ctx.lineTo(w, hitY);
    ctx.stroke();

    // Lane hit indicators
    for (let i = 0; i < LANE_COUNT; i++) {
      const cx = i * laneWidth + laneWidth / 2;
      ctx.beginPath();
      ctx.arc(cx, hitY, 24, 0, Math.PI * 2);
      ctx.strokeStyle = LANE_COLORS[i] + "40";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Notes
    for (const note of activeNotes) {
      if (note.hit || note.missed) continue;

      const cx = note.lane * laneWidth + laneWidth / 2;
      const noteSize = 18 + note.intensity * 8;
      const color = LANE_COLORS[note.lane];

      // Note glow
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;

      // Note body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(cx - noteSize, note.y - noteSize / 2, noteSize * 2, noteSize, 8);
      ctx.fill();

      // Note highlight
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.beginPath();
      ctx.roundRect(cx - noteSize + 2, note.y - noteSize / 2 + 2, noteSize * 2 - 4, noteSize / 2, 6);
      ctx.fill();

      ctx.shadowBlur = 0;
    }

    // Hit effects
    const now = performance.now();
    this.effects = this.effects.filter((e) => {
      const age = now - e.time;
      if (age > 500) return false;

      const alpha = 1 - age / 500;
      const scale = 1 + age / 300;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(e.x, e.y);
      ctx.scale(scale, scale);

      if (e.grade === "perfect") {
        ctx.fillStyle = "#FFD700";
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("PERFECT", 0, -10);
      } else if (e.grade === "good") {
        ctx.fillStyle = "#44DD44";
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("GOOD", 0, -10);
      } else {
        ctx.fillStyle = "#FF4444";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("MISS", 0, -10);
      }

      ctx.restore();
      return true;
    });
  }
}
