import Phaser from 'phaser';
import { nextDelay } from '../logic/ambient';
import type { SpawnRule } from '../logic/catching';
import { facingFor, showMotion, type Dir } from './sprites';

/** Wander speed (px/s) and pauses between little trips (ms). */
const WANDER_SPEED = 22;
const PAUSE_MS: [number, number] = [1500, 4000];
/** Fade-in when one appears. */
const APPEAR_MS = 500;

/** A wild creature roaming its spawn area until caught. */
export interface Critter {
  species: string;
  sprite: Phaser.GameObjects.Sprite;
  rule: SpawnRule;
  target: { x: number; y: number } | null;
  waitMs: number;
  facing: Dir;
}

/**
 * Wild creatures from the catching rules' spawn list (e.g. rabbits in the
 * park): each rule keeps up to `max` out, adding one every `everyMs`, and
 * they wander inside their area. Only species with sprite art are spawned.
 */
export class TownWild {
  readonly critters: Critter[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    rules: SpawnRule[],
    /** Sprite name for a species, or null when it has no art yet. */
    private readonly artFor: (species: string) => string | null,
    private readonly rng: () => number,
  ) {
    for (const rule of rules) {
      if (!artFor(rule.species)) continue;
      this.spawn(rule);
      const again = () =>
        scene.time.delayedCall(nextDelay(rule.everyMs, rng), () => {
          if (this.critters.filter((c) => c.rule === rule).length < rule.max) this.spawn(rule);
          again();
        });
      again();
    }
  }

  private spawn(rule: SpawnRule): void {
    const name = this.artFor(rule.species);
    if (!name) return;
    const p = this.randomIn(rule);
    const sprite = this.scene.add.sprite(p.x, p.y, `${name}_idle_down`).setOrigin(0.5, 0.9).setAlpha(0);
    this.scene.tweens.add({ targets: sprite, alpha: 1, duration: APPEAR_MS });
    this.critters.push({ species: rule.species, sprite, rule, target: null, waitMs: nextDelay(PAUSE_MS, this.rng), facing: 'down' });
  }

  private randomIn(rule: SpawnRule): { x: number; y: number } {
    return { x: rule.area.x + this.rng() * rule.area.w, y: rule.area.y + this.rng() * rule.area.h };
  }

  /** Per frame: pause, then hop over to a new spot in the area. */
  update(dtMs: number): void {
    for (const c of this.critters) {
      const name = this.artFor(c.species);
      if (!name) continue;
      c.sprite.setDepth(c.sprite.y);
      if (!c.target) {
        c.waitMs -= dtMs;
        if (c.waitMs <= 0) c.target = this.randomIn(c.rule);
        continue;
      }
      const dx = c.target.x - c.sprite.x;
      const dy = c.target.y - c.sprite.y;
      const d = Math.hypot(dx, dy);
      const step = (WANDER_SPEED * dtMs) / 1000;
      if (d <= step) {
        c.sprite.setPosition(c.target.x, c.target.y);
        c.target = null;
        c.waitMs = nextDelay(PAUSE_MS, this.rng);
        showMotion(c.sprite, name, c.facing, false);
        continue;
      }
      c.sprite.setPosition(c.sprite.x + (dx / d) * step, c.sprite.y + (dy / d) * step);
      c.facing = facingFor(dx, dy, c.facing);
      showMotion(c.sprite, name, c.facing, true);
    }
  }

  /** The closest critter within `range` of a point, or null. */
  nearest(p: { x: number; y: number }, range: number): Critter | null {
    let best: Critter | null = null;
    let bestD = range;
    for (const c of this.critters) {
      const d = Math.hypot(c.sprite.x - p.x, c.sprite.y - p.y);
      if (d <= bestD) {
        best = c;
        bestD = d;
      }
    }
    return best;
  }

  /** Takes a critter out of the world (caught or fled). */
  remove(c: Critter): void {
    const i = this.critters.indexOf(c);
    if (i >= 0) this.critters.splice(i, 1);
  }
}
