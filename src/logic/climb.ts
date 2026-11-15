/**
 * Tree climbing for wild critters (squirrels): which trees count, where a
 * climber stands to go up, and how its climb progresses. Render-independent.
 * Data: src/data/wild.json.
 */

export interface Pt {
  x: number;
  y: number;
}

/** How one species climbs. */
export interface ClimberRules {
  /** How high up the trunk it goes before vanishing into the leaves (px). */
  height: number;
  /** Climb speed (px/s). */
  speed: number;
  /** Chance (0-1) that a little trip ends in a climb instead of on the ground. */
  chance: number;
  /** Time spent hidden up in the tree (ms), random in range. */
  hideMs: [number, number];
  /** Only trees this close (px) to the climber are used. */
  treeRange: number;
  /** The climb starts this far (px) below the tree's foot line, in front of the trunk. */
  frontDy: number;
}

export interface WildRules {
  /** Town prop sprites that are climbable trees. */
  treeSprites: string[];
  climbers: Record<string, ClimberRules>;
}

const fail = (path: string, msg: string): never => {
  throw new Error(`wild.json ${path}: ${msg}`);
};
const obj = (v: unknown, path: string): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : fail(path, 'expected an object'));
const num = (o: Record<string, unknown>, k: string, path: string, min = 0): number => {
  const v = o[k];
  return typeof v === 'number' && Number.isFinite(v) && v >= min ? v : fail(`${path}.${k}`, `expected a number >= ${min}`);
};

/** Validates wild.json. Throws with the offending path. */
export function parseWildRules(json: unknown): WildRules {
  const o = obj(json, '(root)');
  if (!Array.isArray(o.treeSprites) || !o.treeSprites.every((s) => typeof s === 'string')) fail('treeSprites', 'expected a list of sprite names');
  const co = obj(o.climbers, 'climbers');
  const climbers: Record<string, ClimberRules> = {};
  for (const [species, v] of Object.entries(co)) {
    const p = `climbers.${species}`;
    const c = obj(v, p);
    const chance = num(c, 'chance', p);
    if (chance > 1) fail(`${p}.chance`, 'expected 0-1');
    const h = c.hideMs;
    if (!Array.isArray(h) || h.length !== 2 || typeof h[0] !== 'number' || typeof h[1] !== 'number' || h[0] < 0 || h[0] > h[1]) fail(`${p}.hideMs`, 'expected [min, max]');
    climbers[species] = {
      height: num(c, 'height', p, 1),
      speed: num(c, 'speed', p, 1),
      chance,
      hideMs: [(h as number[])[0], (h as number[])[1]],
      treeRange: num(c, 'treeRange', p, 1),
      frontDy: num(c, 'frontDy', p),
    };
  }
  return { treeSprites: o.treeSprites as string[], climbers };
}

/** The closest tree foot within `range` of p, or null. */
export function nearestTree(p: Pt, trees: Pt[], range: number): Pt | null {
  let best: Pt | null = null;
  let bestD = range;
  for (const t of trees) {
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    if (d <= bestD) {
      best = t;
      bestD = d;
    }
  }
  return best;
}

/** Where a climber stands at the foot of a tree, just in front of the trunk. */
export function trunkFront(tree: Pt, rules: ClimberRules): Pt {
  return { x: tree.x, y: tree.y + rules.frontDy };
}

/**
 * One step of a climb from `base` toward `height` px up (dir 1) or back down
 * (dir -1). Returns the new height above the base, clamped, and whether the
 * end was reached.
 */
export function climbStep(up: number, dir: 1 | -1, rules: ClimberRules, dtMs: number): { up: number; done: boolean } {
  const next = up + (dir * rules.speed * dtMs) / 1000;
  if (dir === 1 && next >= rules.height) return { up: rules.height, done: true };
  if (dir === -1 && next <= 0) return { up: 0, done: true };
  return { up: next, done: false };
}

/**
 * How visible a climber is at a height: fully while low on the trunk, fading
 * out over the top third as it disappears into the leaves.
 */
export function climbAlpha(up: number, rules: ClimberRules): number {
  const fadeFrom = (rules.height * 2) / 3;
  if (up <= fadeFrom) return 1;
  return Math.max(0, 1 - (up - fadeFrom) / (rules.height - fadeFrom));
}
