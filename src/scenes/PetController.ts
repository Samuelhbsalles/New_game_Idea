import Phaser from 'phaser';
import { nextActivity, pickWanderTarget, playerPlan, type PetActivity, type PetPlan, type Rng } from '../logic/petBrain';
import type { PetDef } from '../logic/room';
import { facingFor, showMotion, type Dir } from './sprites';

/** How close (px) counts as "arrived" at a target. */
const ARRIVE_PX = 4;

/**
 * Drives the pet sprite: asks petBrain what to do next, walks to the spot,
 * plays the activity, repeats. Player actions interrupt via `command`.
 */
export class PetController {
  readonly sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private plan: PetPlan = { activity: 'idle', durationMs: 0 };
  private phase: 'moving' | 'doing' = 'doing';
  private target: { x: number; y: number } | null = null;
  private remainingMs = 0;
  private moveBudgetMs = 0;
  private facing: Dir = 'down';
  private paused = false;
  private onFinish: ((a: PetActivity) => void) | null = null;
  private zzz: Phaser.GameObjects.Text | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly def: PetDef,
    private readonly name: string,
    private readonly floor: boolean[][],
    private readonly tileSize: number,
    private readonly blocked: { x: number; y: number; w: number; h: number }[],
    private readonly rng: Rng,
    private readonly sleepColor: string,
  ) {
    this.sprite = scene.physics.add.sprite(def.x, def.y, `${name}_idle_down`);
    this.sprite.body.setSize(18, 12).setOffset(15, 30);
    this.start(nextActivity(def.tuning, rng));
  }

  /** The activity the pet is doing (or walking to do). */
  get activity(): PetActivity {
    return this.plan.activity;
  }

  /** Player-chosen action. `onFinish` runs when it ends (e.g. to wake up). */
  command(activity: 'petted' | 'eat' | 'sleep', onFinish?: (a: PetActivity) => void): void {
    this.start(playerPlan(this.def.tuning, activity, this.rng));
    this.onFinish = onFinish ?? null;
  }

  /** Freeze while a menu is open; the current plan resumes afterwards. */
  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.sprite.setVelocity(0, 0);
      if (this.phase === 'moving') showMotion(this.sprite, this.name, this.facing, false);
    }
  }

  /** Turns the pet to look at a point (used when the player talks to it). */
  faceTowards(x: number, y: number): void {
    if (this.plan.activity === 'sleep' && this.phase === 'doing') return;
    this.facing = facingFor(x - this.sprite.x, y - this.sprite.y, this.facing);
    if (this.phase === 'doing' && this.plan.activity !== 'eat') showMotion(this.sprite, this.name, this.facing, false);
  }

  update(dtMs: number): void {
    this.sprite.setDepth(this.sprite.y + this.sprite.height / 2);
    this.zzz?.setPosition(this.sprite.x + 10, this.sprite.y - 22);
    if (this.paused) return;

    if (this.phase === 'moving' && this.target) {
      this.moveBudgetMs -= dtMs;
      const dx = this.target.x - this.sprite.x;
      const dy = this.target.y - this.sprite.y;
      if (Math.hypot(dx, dy) <= ARRIVE_PX || this.moveBudgetMs <= 0) {
        this.sprite.setVelocity(0, 0);
        this.arrive();
      } else {
        this.scene.physics.moveTo(this.sprite, this.target.x, this.target.y, this.def.speed);
        this.facing = facingFor(dx, dy, this.facing);
        showMotion(this.sprite, this.name, this.facing, true);
      }
      return;
    }

    this.remainingMs -= dtMs;
    if (this.remainingMs <= 0) this.finish();
  }

  private start(plan: PetPlan): void {
    this.clearDoing();
    this.plan = plan;
    this.sprite.setVelocity(0, 0);
    this.target = null;
    if (plan.activity === 'wander') {
      this.target = pickWanderTarget(this.floor, this.tileSize, this.blocked, this.rng);
    } else if (plan.activity === 'eat') {
      this.target = this.def.eatSpot;
    } else if (plan.activity === 'sleep') {
      this.target = this.def.sleepSpot;
    }
    if (this.target) {
      this.phase = 'moving';
      // A wander walks for its own duration; eat/sleep get the same budget to reach their spot.
      this.moveBudgetMs = plan.activity === 'wander' ? plan.durationMs : Math.max(plan.durationMs, 6000);
    } else {
      this.arrive();
    }
  }

  private arrive(): void {
    this.phase = 'doing';
    this.remainingMs = this.plan.activity === 'wander' ? 0 : this.plan.durationMs;
    const a = this.plan.activity;
    if (a === 'eat') {
      this.sprite.setFlipX(false);
      this.sprite.anims.play(`${this.name}_eat`, true);
    } else if (a === 'sleep') {
      this.sprite.setFlipX(false);
      this.sprite.anims.play(`${this.name}_sleep`, true);
      this.zzz = this.scene.add
        .text(this.sprite.x + 10, this.sprite.y - 22, 'z', { fontFamily: 'monospace', fontSize: '12px', color: this.sleepColor })
        .setDepth(10_000);
      this.scene.tweens.add({ targets: this.zzz, alpha: 0.2, yoyo: true, repeat: -1, duration: 700 });
    } else {
      showMotion(this.sprite, this.name, this.facing, false);
    }
  }

  private finish(): void {
    const done = this.plan.activity;
    const cb = this.onFinish;
    this.onFinish = null;
    this.clearDoing();
    cb?.(done);
    this.start(nextActivity(this.def.tuning, this.rng, done));
  }

  private clearDoing(): void {
    this.sprite.anims.stop();
    if (this.zzz) {
      this.scene.tweens.killTweensOf(this.zzz);
      this.zzz.destroy();
      this.zzz = null;
    }
  }
}
