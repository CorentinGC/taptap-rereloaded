import type { Beatmap, ActiveNote, HitGrade, Difficulty } from "./types";
import { GameRenderer } from "./renderer";
import { InputHandler } from "./input-handler";
import { SCROLL_TIME, HIT_LINE_POSITION, DIFFICULTY_CONFIGS } from "@/lib/utils/constants";

interface EngineCallbacks {
  onScoreUpdate: (grade: HitGrade) => void;
  onTimeUpdate: (time: number) => void;
  onEnd: () => void;
}

export class GameEngine {
  private beatmap: Beatmap;
  private renderer: GameRenderer;
  private inputHandler: InputHandler;
  private activeNotes: ActiveNote[] = [];
  private allNotes: ActiveNote[];
  private getCurrentTime: () => number;
  private callbacks: EngineCallbacks;
  private animFrameId: number | null = null;
  private running = false;
  private canvasHeight: number;
  private canvasWidth: number;
  private goodWindow: number;

  constructor(
    canvas: HTMLCanvasElement,
    beatmap: Beatmap,
    getCurrentTime: () => number,
    callbacks: EngineCallbacks,
    difficulty: Difficulty = "normal"
  ) {
    this.beatmap = beatmap;
    this.renderer = new GameRenderer(canvas);
    this.getCurrentTime = getCurrentTime;
    this.callbacks = callbacks;
    this.canvasHeight = canvas.height;
    this.canvasWidth = canvas.width;

    const config = DIFFICULTY_CONFIGS[difficulty];
    this.goodWindow = config.goodWindow;

    // Prepare all notes
    this.allNotes = beatmap.notes.map((n) => ({
      ...n,
      y: 0,
      hit: false,
      missed: false,
    }));

    // Setup input (keyboard + touch)
    this.inputHandler = new InputHandler(
      canvas,
      this.handleHit.bind(this),
      this.handleMiss.bind(this),
      () => this.activeNotes,
      getCurrentTime,
      config.perfectWindow,
      config.goodWindow
    );
  }

  private handleHit(note: ActiveNote, grade: HitGrade) {
    note.hit = true;
    this.callbacks.onScoreUpdate(grade);

    const laneWidth = this.canvasWidth / 4;
    this.renderer.addEffect({
      x: note.lane * laneWidth + laneWidth / 2,
      y: this.canvasHeight * HIT_LINE_POSITION,
      grade,
      time: performance.now(),
      alpha: 1,
    });
  }

  private handleMiss(lane: number) {
    this.callbacks.onScoreUpdate("miss");

    const laneWidth = this.canvasWidth / 4;
    this.renderer.addEffect({
      x: lane * laneWidth + laneWidth / 2,
      y: this.canvasHeight * HIT_LINE_POSITION,
      grade: "miss",
      time: performance.now(),
      alpha: 1,
    });
  }

  resize(width: number, height: number) {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.renderer.resize(width, height);
  }

  start() {
    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  destroy() {
    this.stop();
    this.inputHandler.destroy();
  }

  private loop() {
    if (!this.running) return;

    const currentTime = this.getCurrentTime();
    this.callbacks.onTimeUpdate(currentTime);

    const hitY = this.canvasHeight * HIT_LINE_POSITION;

    this.activeNotes = this.allNotes.filter((note) => {
      const delta = note.time - currentTime;
      return delta > -this.goodWindow * 2 && delta < SCROLL_TIME;
    });

    for (const note of this.activeNotes) {
      const delta = note.time - currentTime;
      note.y = hitY - (delta / SCROLL_TIME) * hitY;

      if (!note.hit && !note.missed && currentTime - note.time > this.goodWindow) {
        note.missed = true;
        this.callbacks.onScoreUpdate("miss");
      }
    }

    this.renderer.render(this.activeNotes);

    const lastNote = this.allNotes[this.allNotes.length - 1];
    const endTime = Math.max(
      this.beatmap.duration,
      lastNote ? lastNote.time + 2 : 0
    );
    if (currentTime > endTime) {
      this.callbacks.onEnd();
      this.stop();
      return;
    }

    this.animFrameId = requestAnimationFrame(() => this.loop());
  }
}
