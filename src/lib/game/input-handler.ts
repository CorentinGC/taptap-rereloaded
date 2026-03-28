import type { ActiveNote, HitGrade } from "./types";
import { LANE_KEYS, LANE_COUNT } from "@/lib/utils/constants";

export type HitCallback = (note: ActiveNote, grade: HitGrade) => void;
export type MissCallback = (lane: number) => void;

export class InputHandler {
  private keyMap: Map<string, number>;
  private onHit: HitCallback;
  private onMiss: MissCallback;
  private getActiveNotes: () => ActiveNote[];
  private getCurrentTime: () => number;
  private perfectWindow: number;
  private goodWindow: number;
  private canvas: HTMLCanvasElement;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundTouchStart: (e: TouchEvent) => void;

  constructor(
    canvas: HTMLCanvasElement,
    onHit: HitCallback,
    onMiss: MissCallback,
    getActiveNotes: () => ActiveNote[],
    getCurrentTime: () => number,
    perfectWindow: number,
    goodWindow: number
  ) {
    this.keyMap = new Map(LANE_KEYS.map((key, i) => [key, i]));
    this.canvas = canvas;
    this.onHit = onHit;
    this.onMiss = onMiss;
    this.getActiveNotes = getActiveNotes;
    this.getCurrentTime = getCurrentTime;
    this.perfectWindow = perfectWindow;
    this.goodWindow = goodWindow;

    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundTouchStart = this.handleTouchStart.bind(this);

    window.addEventListener("keydown", this.boundKeyDown);
    canvas.addEventListener("touchstart", this.boundTouchStart, {
      passive: false,
    });
  }

  private tryHitLane(lane: number) {
    const currentTime = this.getCurrentTime();
    const notes = this.getActiveNotes();

    let closest: ActiveNote | null = null;
    let closestDist = Infinity;

    for (const note of notes) {
      if (note.lane !== lane || note.hit || note.missed) continue;
      const dist = Math.abs(note.time - currentTime);
      if (dist < closestDist) {
        closestDist = dist;
        closest = note;
      }
    }

    if (closest && closestDist <= this.goodWindow) {
      const grade: HitGrade =
        closestDist <= this.perfectWindow ? "perfect" : "good";
      this.onHit(closest, grade);
    } else {
      this.onMiss(lane);
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    const lane = this.keyMap.get(e.key.toLowerCase());
    if (lane === undefined) return;
    e.preventDefault();
    this.tryHitLane(lane);
  }

  private handleTouchStart(e: TouchEvent) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const laneWidth = rect.width / LANE_COUNT;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const x = touch.clientX - rect.left;
      const lane = Math.min(LANE_COUNT - 1, Math.max(0, Math.floor(x / laneWidth)));
      this.tryHitLane(lane);
    }
  }

  destroy() {
    window.removeEventListener("keydown", this.boundKeyDown);
    this.canvas.removeEventListener("touchstart", this.boundTouchStart);
  }
}
