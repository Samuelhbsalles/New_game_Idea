import Phaser from 'phaser';
import { nextDelay } from '../logic/ambient';
import type { AreaBox, AreaRule } from '../logic/catching';
import { climbAlpha, climbStep, nearestTree, trunkFront, type ClimberRules, type WildRules } from '../logic/climb';
import { findPath, type NavGrid, type Pt } from '../logic/npcMind';
import { facingFor, showMotion, type Dir } from './sprites';

/** Wander speed (px/s) and pauses between little trips (ms). */
const WANDER_SPEED = 22;
const PAUSE_MS: [number, number] = [1500, 4000];
/** Fade-in when one appears on the ground. */
const APPEAR_MS = 500;
/** A scared critter runs this far (px) over this long (ms) while fading out. */
const FLEE_PX = 70;
const FLEE_MS = 700;

/** Where a climber is on its tree: walking to it, going up, hidden in the leaves, coming down. */
interface Climb {
  tree: Pt;
  base: Pt;
  /** Height above the base (px). */
  up: number;
  phase: 'toTree' | 'up' | 'hidden' | 'down';
  hideLeft: number;
}

/** A wild creature roaming its spawn area until caught. */
export interface Critter {
  species: string;
  sprite: Phaser.GameObjects.Sprite;
  area: AreaRule & { inTown: NonNullable<AreaRule['inTown']> };
  /** Remaining waypoints of the current little trip (empty while resting). */
  path: Pt[];
  waitMs: number;
  facing: Dir;
  /** Set while a climber is using a tree; null on the ground. */
  climb: Climb | null;
  /** True while bait (TownLure) is in charge of it: it does not wander on its own. */
  lured?: boolean;
  /** The rectangle of its area it appeared in: it wanders there (areas can span the whole town). */
  box: AreaBox;
}

/** Trees critters may climb, and who climbs them. */
export interface Climbing {
  rules: WildRules;
  /** Foot points of climbable trees. */
  trees: Pt[];
}

/**
 * Wild creatures in the town's neighbourhoods (catching.json areas with a
 * town rectangle): each area keeps up to `max` out, adding one every
 * `everyMs`; who appears is up to `pick` (rarity, time of day, weather, and
 * only species with art). They wander inside their area. Climbers (squirrels)
 * come down a nearby tree when they appear, and now and then run up one to
 * hide in the leaves for a while (wild.json).
 */
export class TownWild {
  readonly critters: Critter[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    areas: AreaRule[],
    /** Which species appears in an area right now, or null for nobody. */
    private readonly pick: (areaId: string) => string | null,
    /** Sprite name for a species, or null when it has no art yet. */
    private readonly artFor: (species: string) => string | null,
    /** Walkable grid: critters only stand on, and walk between, free cells. */
    private readonly nav: NavGrid,
    private readonly rng: () => number,
    /** Display scale per species (small animals read smaller than people). */
    private readonly scaleFor: (species: string) => number = () => 1,
    private readonly climbing: Climbing | null = null,
  ) {
    for (const a of areas) {
      if (!a.inTown || a.max <= 0) continue;
      const area = a as Critter['area'];
      for (let i = 0; i < area.start; i++) this.spawn(area);
      const again = () =>
        scene.time.delayedCall(nextDelay(area.everyMs, rng), () => {
          if (this.critters.filter((c) => c.area === area).length < area.max) this.spawn(area);
          again();
        });
      again();
    }
  }

  private climberRules(species: string): ClimberRules | null {
    return this.climbing?.rules.climbers[species] ?? null;
  }

  private spawn(area: Critter['area']): void {
    const species = this.pick(area.id);
    const name = species ? this.artFor(species) : null;
    if (!species || !name) return;
    const p = this.randomIn(area);
    if (!p) return;
    const sprite = this.scene.add.sprite(p.x, p.y, `${name}_idle_down`).setOrigin(0.5, 0.9).setScale(this.scaleFor(species)).setAlpha(0);
    const critter: Critter = { species, sprite, area, path: [], waitMs: nextDelay(PAUSE_MS, this.rng), facing: 'down', climb: null, box: p.box };
    this.critters.push(critter);
    // A climber near a tree arrives by coming down it; everyone else fades in where they stand.
    const rules = this.climberRules(species);
    const tree = rules && this.climbing ? nearestTree(p, this.climbing.trees, rules.treeRange) : null;
    if (rules && tree) {
      const base = trunkFront(tree, rules);
      critter.climb = { tree, base, up: rules.height, phase: 'down', hideLeft: 0 };
      sprite.setPosition(base.x, base.y - rules.height);
      return;
    }
    this.scene.tweens.add({ targets: sprite, alpha: 1, duration: APPEAR_MS });
  }

  /** A random free spot in the area (never inside a tree trunk, bench or building), or null. */
  private randomIn(area: Critter['area'], only?: AreaBox): (Pt & { box: AreaBox }) | null {
    const g = this.nav;
    // Bigger rectangles get more creatures: pick one weighted by its size (or stay in `only`).
    const boxes = only ? [only] : area.inTown;
    const total = boxes.reduce((t, b) => t + b.w * b.h, 0);
    for (let i = 0; i < 20; i++) {
      let pick = this.rng() * total;
      const r = boxes.find((b) => (pick -= b.w * b.h) < 0) ?? boxes[boxes.length - 1];
      const x = r.x + this.rng() * r.w;
      const y = r.y + this.rng() * r.h;
      const cx = Math.floor(x / g.cell);
      const cy = Math.floor(y / g.cell);
      if (g.free[cy]?.[cx]) return { x, y, box: r };
    }
    return null;
  }


  /** Per frame: pause, then hop over to a new spot in the area (or climb a tree). */
  update(dtMs: number): void {
    for (const c of this.critters) {
      const name = this.artFor(c.species);
      if (!name) continue;
      c.sprite.setDepth(c.sprite.y);
      if (c.lured) continue;
      if (c.climb && c.climb.phase !== 'toTree') {
        this.updateClimb(c, name, dtMs);
        continue;
      }
      const wp = c.path[0];
      if (!wp) {
        if (c.climb?.phase === 'toTree') {
          c.climb.phase = 'up';
          continue;
        }
        c.waitMs -= dtMs;
        if (c.waitMs <= 0) this.planTrip(c);
        continue;
      }
      const dx = wp.x - c.sprite.x;
      const dy = wp.y - c.sprite.y;
      const d = Math.hypot(dx, dy);
      const step = (WANDER_SPEED * dtMs) / 1000;
      if (d <= step) {
        c.sprite.setPosition(wp.x, wp.y);
        c.path.shift();
        if (c.path.length === 0) showMotion(c.sprite, name, c.facing, false);
        continue;
      }
      c.sprite.setPosition(c.sprite.x + (dx / d) * step, c.sprite.y + (dy / d) * step);
      c.facing = facingFor(dx, dy, c.facing);
      showMotion(c.sprite, name, c.facing, true);
    }
  }

  /** Next little trip: usually a spot in the area; for a climber, sometimes the nearest tree. */
  private planTrip(c: Critter): void {
    c.waitMs = nextDelay(PAUSE_MS, this.rng);
    const rules = this.climberRules(c.species);
    const tree = rules && this.climbing ? nearestTree(c.sprite, this.climbing.trees, rules.treeRange) : null;
    if (rules && tree && this.rng() < rules.chance) {
      const base = trunkFront(tree, rules);
      const path = findPath(this.nav, c.sprite, base);
      if (path.length > 0 || Math.hypot(base.x - c.sprite.x, base.y - c.sprite.y) < 2) {
        c.path = path;
        c.climb = { tree, base, up: 0, phase: 'toTree', hideLeft: 0 };
        return;
      }
    }
    const goal = this.randomIn(c.area, c.box);
    c.path = goal ? findPath(this.nav, c.sprite, goal) : [];
  }

  /** Going up the trunk, waiting in the leaves, or coming back down. */
  private updateClimb(c: Critter, name: string, dtMs: number): void {
    const climb = c.climb!;
    const rules = this.climberRules(c.species);
    if (!rules) {
      c.climb = null;
      return;
    }
    // In front of its own tree's trunk (trees sort by their foot line).
    c.sprite.setDepth(climb.tree.y + 1);
    if (climb.phase === 'hidden') {
      climb.hideLeft -= dtMs;
      if (climb.hideLeft <= 0) climb.phase = 'down';
      return;
    }
    const dir = climb.phase === 'up' ? 1 : -1;
    const r = climbStep(climb.up, dir, rules, dtMs);
    climb.up = r.up;
    c.sprite.setPosition(climb.base.x, climb.base.y - climb.up).setAlpha(climbAlpha(climb.up, rules));
    const anim = `${name}_climb_up`;
    if (this.scene.anims.exists(anim)) c.sprite.anims.play(anim, true);
    if (!r.done) return;
    if (dir === 1) {
      climb.phase = 'hidden';
      climb.hideLeft = nextDelay(rules.hideMs, this.rng);
      return;
    }
    // Back on the ground: wander again, facing away from the trunk.
    c.climb = null;
    c.facing = 'down';
    c.sprite.setAlpha(1);
    showMotion(c.sprite, name, c.facing, false);
    c.waitMs = nextDelay(PAUSE_MS, this.rng);
  }

  /** The closest critter on the ground within `range` of a point, or null (up a tree = out of reach). */
  nearest(p: { x: number; y: number }, range: number): Critter | null {
    let best: Critter | null = null;
    let bestD = range;
    for (const c of this.critters) {
      if (c.climb && c.climb.phase !== 'toTree') continue;
      const d = Math.hypot(c.sprite.x - p.x, c.sprite.y - p.y);
      if (d <= bestD) {
        best = c;
        bestD = d;
      }
    }
    return best;
  }

  /** Critters on the ground going about their business: the ones bait can attract. */
  free(): Critter[] {
    return this.critters.filter((c) => !c.lured && !c.climb);
  }

  /** Hands a critter back to its own wandering (bait gone, nothing happened). */
  release(c: Critter): void {
    c.lured = false;
    c.path = [];
    c.waitMs = nextDelay(PAUSE_MS, this.rng);
    const name = this.artFor(c.species);
    if (name) showMotion(c.sprite, name, c.facing, false);
  }

  /** Scared: it dashes away from `from`, fades out and is gone. */
  flee(c: Critter, from: Pt): void {
    c.lured = true;
    this.remove(c);
    const dx = c.sprite.x - from.x;
    const dy = c.sprite.y - from.y;
    const d = Math.hypot(dx, dy) || 1;
    c.facing = facingFor(dx, dy, c.facing);
    const name = this.artFor(c.species);
    if (name) showMotion(c.sprite, name, c.facing, true);
    this.scene.tweens.add({ targets: c.sprite, x: c.sprite.x + (dx / d) * FLEE_PX, y: c.sprite.y + (dy / d) * FLEE_PX, alpha: 0, duration: FLEE_MS, onComplete: () => c.sprite.destroy() });
  }

  /** Takes a critter out of the world (caught or fled). */
  remove(c: Critter): void {
    const i = this.critters.indexOf(c);
    if (i >= 0) this.critters.splice(i, 1);
  }
}
