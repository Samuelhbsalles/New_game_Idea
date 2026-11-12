import Phaser from 'phaser';
import {
  followTarget,
  nextActivity,
  pickWanderTarget,
  playerPlan,
  type AutoActivity,
  type PetActivity,
  type PetPlan,
  type Rng,
} from '../logic/petBrain';
import type { PetDef, UseKind, UseSpot } from '../logic/room';
import { facingFor, showMotion, type Dir } from './sprites';

/** How close (px) counts as "arrived" at a target. */
const ARRIVE_PX = 4;
/** Longest walk (ms) to reach a spot before giving up (stuck behind furniture). */
const MOVE_BUDGET_MS = 7000;
/** Hop on/off furniture duration (ms). */
const HOP_MS = 260;
/** An asking pet walks this close to the player. */
const ASK_DISTANCE = 30;

/** What the pet needs from the scene, injected so the controller stays scene-agnostic. */
export interface PetHooks {
  /** Spot for a furniture use, or null if the room has none (e.g. no sofa bought yet). */
  spot(kind: UseKind): UseSpot | null;
  /** True if the bowl has food. */
  bowlHasFood(): boolean;
  /** Called on arriving at the bowl; returns false if it was empty after all. */
  eatFromBowl(): boolean;
  /** Where the player stands now. */
  playerPos(): { x: number; y: number };
  /** Shows a short floating message above the pet. */
  say(msg: string): void;
  sleepColor: string;
  heartColor: string;
}

/**
 * Drives the pet sprite: asks petBrain what to do next, walks to the right
 * spot (bowl, pet bed, sofa, the player), plays the activity, repeats.
 * Player choices interrupt via `command`; following lasts until `stay`.
 */
export class PetController {
  readonly sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private plan: PetPlan = { activity: 'idle', durationMs: 0 };
  private phase: 'moving' | 'hopping' | 'doing' = 'doing';
  private target: { x: number; y: number } | null = null;
  private use: UseSpot | null = null;
  private onFurniture: UseSpot | null = null;
  private handFed = false;
  private remainingMs = 0;
  private moveBudgetMs = 0;
  private facing: Dir = 'down';
  private paused = false;
  private onFinish: ((a: PetActivity) => void) | null = null;
  private badge: Phaser.GameObjects.Text | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly def: PetDef,
    private readonly name: string,
    private readonly floor: boolean[][],
    private readonly tileSize: number,
    private readonly blocked: { x: number; y: number; w: number; h: number }[],
    private readonly rng: Rng,
    private readonly hooks: PetHooks,
  ) {
    this.sprite = scene.physics.add.sprite(def.x, def.y, `${name}_idle_down`);
    this.sprite.body.setSize(18, 12).setOffset(15, 30);
    this.start(this.autoPlan());
  }

  /** The activity the pet is doing (or walking to do). */
  get activity(): PetActivity {
    return this.plan.activity;
  }

  /** True while the pet is following the player. */
  get following(): boolean {
    return this.plan.activity === 'follow';
  }

  /** True while the pet is waiting for pets (petting it now earns a happy reaction). */
  get asking(): boolean {
    return this.plan.activity === 'askPet' && this.phase === 'doing';
  }

  /**
   * Player-chosen action. 'eat' here means hand-fed: eaten on the spot, no bowl.
   * 'stay' ends following. `onFinish` runs when the action ends.
   */
  command(activity: 'petted' | 'eat' | 'sleep' | 'follow' | 'stay', onFinish?: (a: PetActivity) => void): void {
    if (activity === 'stay') {
      this.start(this.autoPlan('follow'));
      return;
    }
    this.handFed = activity === 'eat';
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
    if (this.onFurniture || this.phase !== 'doing' || this.plan.activity === 'eat' || this.plan.activity === 'sleep') return;
    this.facing = facingFor(x - this.sprite.x, y - this.sprite.y, this.facing);
    showMotion(this.sprite, this.name, this.facing, false);
  }

  update(dtMs: number): void {
    const s = this.sprite;
    // On furniture the pet draws just above it; elsewhere it depth-sorts by its feet.
    s.setDepth(this.onFurniture ? this.onFurniture.item.y + this.onFurniture.item.h / 2 + 1 : s.y + s.height / 2);
    this.badge?.setPosition(s.x + 10, s.y - 24);
    if (this.paused || this.phase === 'hopping') return;

    if (this.plan.activity === 'follow') {
      this.updateFollow();
      return;
    }

    if (this.phase === 'moving' && this.target) {
      this.moveBudgetMs -= dtMs;
      // An asking pet keeps homing in on the player as they move.
      if (this.plan.activity === 'askPet') {
        this.target = followTarget(s, this.hooks.playerPos(), ASK_DISTANCE) ?? { x: s.x, y: s.y };
      }
      const dx = this.target.x - s.x;
      const dy = this.target.y - s.y;
      if (Math.hypot(dx, dy) <= ARRIVE_PX || this.moveBudgetMs <= 0) {
        s.setVelocity(0, 0);
        this.reachedTarget(this.moveBudgetMs > 0);
      } else {
        this.scene.physics.moveTo(s, this.target.x, this.target.y, this.def.speed);
        this.facing = facingFor(dx, dy, this.facing);
        showMotion(s, this.name, this.facing, true);
      }
      return;
    }

    this.remainingMs -= dtMs;
    if (this.remainingMs <= 0) this.finish();
  }

  // ---- planning ----------------------------------------------------------------

  private autoPlan(previous?: PetActivity): PetPlan {
    const allowed = (a: AutoActivity) => {
      if (a === 'eat') return this.hooks.bowlHasFood() && this.hooks.spot('eat') !== null;
      if (a === 'lounge') return this.hooks.spot('lounge') !== null;
      return true;
    };
    return nextActivity(this.def.tuning, this.rng, previous, allowed);
  }

  private start(plan: PetPlan): void {
    this.clearBadge();
    this.sprite.anims.stop();
    if (this.onFurniture) this.jumpOff();
    this.plan = plan;
    this.sprite.setVelocity(0, 0);
    this.target = null;
    this.use = null;
    const a = plan.activity;
    if (a === 'wander') {
      this.target = pickWanderTarget(this.floor, this.tileSize, this.blocked, this.rng);
    } else if ((a === 'eat' && !this.handFed) || a === 'sleep' || a === 'lounge') {
      this.use = this.hooks.spot(a === 'eat' ? 'eat' : a === 'sleep' ? 'sleep' : 'lounge');
      if (this.use) this.target = this.use.approach ?? this.use.spot;
    } else if (a === 'askPet') {
      this.target = followTarget(this.sprite, this.hooks.playerPos(), ASK_DISTANCE);
    }
    if (a === 'follow') {
      this.phase = 'doing';
      return;
    }
    if (this.target) {
      this.phase = 'moving';
      this.moveBudgetMs = a === 'wander' ? plan.durationMs : MOVE_BUDGET_MS;
    } else {
      this.begin();
    }
  }

  /** Arrived at (or gave up on) the walk target. */
  private reachedTarget(arrived: boolean): void {
    const a = this.plan.activity;
    if (a === 'wander') return this.finish();
    if (!arrived && a !== 'askPet') return this.finish(); // stuck: pick something else
    if (this.use?.approach) return this.hopOn(this.use);
    this.begin();
  }

  /** Starts the activity itself at the current spot. */
  private begin(): void {
    this.phase = 'doing';
    this.remainingMs = this.plan.durationMs;
    const a = this.plan.activity;
    if (a === 'eat') {
      if (!this.handFed && !this.hooks.eatFromBowl()) return this.finish(); // bowl emptied meanwhile
      this.play('eat');
    } else if (a === 'sleep') {
      this.play('sleep');
      this.showBadge('z', this.hooks.sleepColor, true);
    } else if (a === 'lounge') {
      this.play('sleep');
    } else if (a === 'askPet') {
      const p = this.hooks.playerPos();
      this.facing = facingFor(p.x - this.sprite.x, p.y - this.sprite.y, this.facing);
      showMotion(this.sprite, this.name, this.facing, false);
      this.showBadge('♥?', this.hooks.heartColor, true);
    } else if (a === 'petted') {
      showMotion(this.sprite, this.name, this.facing, false);
      this.hearts();
    } else {
      showMotion(this.sprite, this.name, this.facing, false);
    }
  }

  private finish(): void {
    const done = this.plan.activity;
    const cb = this.onFinish;
    this.onFinish = null;
    this.handFed = false;
    cb?.(done);
    this.start(this.autoPlan(done));
  }

  // ---- follow --------------------------------------------------------------------

  private updateFollow(): void {
    const s = this.sprite;
    const goal = followTarget(s, this.hooks.playerPos(), this.def.followDistance);
    if (!goal) {
      s.setVelocity(0, 0);
      showMotion(s, this.name, this.facing, false);
      return;
    }
    this.scene.physics.moveTo(s, goal.x, goal.y, this.def.speed * 2);
    this.facing = facingFor(goal.x - s.x, goal.y - s.y, this.facing);
    showMotion(s, this.name, this.facing, true);
  }

  // ---- furniture hops --------------------------------------------------------

  private hopOn(use: UseSpot): void {
    this.phase = 'hopping';
    this.sprite.body.enable = false;
    this.onFurniture = use;
    this.scene.tweens.add({
      targets: this.sprite,
      x: use.spot.x,
      y: use.spot.y,
      duration: HOP_MS,
      ease: 'Quad.easeOut',
      onComplete: () => this.begin(),
    });
  }

  /** Leaves furniture at once (used when a new plan starts). */
  private jumpOff(): void {
    const use = this.onFurniture;
    if (!use) return;
    this.scene.tweens.killTweensOf(this.sprite);
    const back = use.approach ?? use.spot;
    this.sprite.setPosition(back.x, back.y);
    this.sprite.body.reset(back.x, back.y);
    this.sprite.body.enable = true;
    this.onFurniture = null;
  }

  // ---- visuals -------------------------------------------------------------------

  private play(action: 'eat' | 'sleep'): void {
    this.sprite.setFlipX(false);
    this.sprite.anims.play(`${this.name}_${action}`, true);
  }

  private showBadge(text: string, color: string, pulse: boolean): void {
    this.clearBadge();
    this.badge = this.scene.add
      .text(this.sprite.x + 10, this.sprite.y - 24, text, { fontFamily: 'monospace', fontSize: '12px', color, fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(40_000);
    if (pulse) this.scene.tweens.add({ targets: this.badge, alpha: 0.3, yoyo: true, repeat: -1, duration: 600 });
  }

  private clearBadge(): void {
    if (!this.badge) return;
    this.scene.tweens.killTweensOf(this.badge);
    this.badge.destroy();
    this.badge = null;
  }

  /** Little hearts rising from the pet. */
  hearts(count = 3): void {
    for (let i = 0; i < count; i++) {
      const h = this.scene.add
        .text(this.sprite.x + (i - (count - 1) / 2) * 8, this.sprite.y - 18, '♥', {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: this.hooks.heartColor,
        })
        .setOrigin(0.5)
        .setDepth(40_000);
      this.scene.tweens.add({ targets: h, y: h.y - 22, alpha: 0, delay: i * 160, duration: 900, onComplete: () => h.destroy() });
    }
  }
}
