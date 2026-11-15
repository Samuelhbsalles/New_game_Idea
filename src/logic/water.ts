/**
 * Water animation rules (render-independent): which tiles get wave crests, and
 * which water pixels of a shore tile are close enough to the bank to foam.
 * Data: src/data/water.json. Drawn by src/scenes/waterFx.ts.
 */

/** Little light wave crests drifting on open water. */
export interface CrestRules {
  /** One new crest is tried this often (ms). */
  everyMs: number;
  /** How long a crest lives (ms), random in range. */
  lifeMs: [number, number];
  /** How far it drifts sideways over its life (px), random in range. */
  drift: [number, number];
  /** Peak opacity, 0-1. */
  alpha: number;
  /** Crest colour, "#rrggbb". */
  color: string;
  /** Darker trough under the crest, "#rrggbb" (gives it contrast on light water). */
  shadow: string;
}

/** Foam lapping at the bank: a near band and a far band that pulse in turn. */
export interface FoamRules {
  color: string;
  /** Distance from the bank (px) of the near band, inclusive range. */
  near: [number, number];
  /** Distance from the bank (px) of the far band, inclusive range. */
  far: [number, number];
  /** One full in-and-out cycle (ms). */
  periodMs: number;
  /** Opacity low and high of each band's pulse. */
  alpha: [number, number];
}

export interface WaterRules {
  crests: CrestRules;
  foam: FoamRules;
}

const fail = (path: string, msg: string): never => {
  throw new Error(`water.json ${path}: ${msg}`);
};
const num = (v: unknown, path: string, min = 0): number => (typeof v === 'number' && Number.isFinite(v) && v >= min ? v : fail(path, `expected a number >= ${min}`));
const pair = (v: unknown, path: string): [number, number] => {
  if (!Array.isArray(v) || v.length !== 2) return fail(path, 'expected [min, max]');
  const a = num(v[0], `${path}[0]`);
  const b = num(v[1], `${path}[1]`);
  return a <= b ? [a, b] : fail(path, 'min is above max');
};
const color = (v: unknown, path: string): string => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fail(path, 'expected "#rrggbb"'));
const obj = (v: unknown, path: string): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : fail(path, 'expected an object'));

/** Validates water.json. Throws with the offending path. */
export function parseWaterRules(json: unknown): WaterRules {
  const o = obj(json, '(root)');
  const c = obj(o.crests, 'crests');
  const f = obj(o.foam, 'foam');
  const alpha = num(c.alpha, 'crests.alpha');
  if (alpha > 1) fail('crests.alpha', 'expected 0-1');
  const fa = pair(f.alpha, 'foam.alpha');
  if (fa[1] > 1) fail('foam.alpha', 'expected 0-1');
  return {
    crests: { everyMs: num(c.everyMs, 'crests.everyMs', 1), lifeMs: pair(c.lifeMs, 'crests.lifeMs'), drift: pair(c.drift, 'crests.drift'), alpha, color: color(c.color, 'crests.color'), shadow: color(c.shadow, 'crests.shadow') },
    foam: { color: color(f.color, 'foam.color'), near: pair(f.near, 'foam.near'), far: pair(f.far, 'foam.far'), periodMs: num(f.periodMs, 'foam.periodMs', 1), alpha: fa },
  };
}

/** True when all four corners of tile (tx, ty) are water ('w') in the town corner grid. */
export function isOpenWater(corners: string[], tx: number, ty: number): boolean {
  const a = corners[ty];
  const b = corners[ty + 1];
  if (!a || !b) return false;
  return a[tx] === 'w' && a[tx + 1] === 'w' && b[tx] === 'w' && b[tx + 1] === 'w';
}

/** Is this RGBA pixel water (clearly blue)? Grass is green, the bank is brown. */
export function isWaterPixel(r: number, g: number, b: number, a: number): boolean {
  return a > 128 && b > r + 40 && b >= g;
}

/**
 * Distance (px, 4-neighbour steps) from each water pixel to the nearest
 * non-water pixel, within one tile frame; 0 for non-water pixels. Pixels past
 * the frame edge do not count as bank, so open water touching the frame edge
 * is not mistaken for shore. Distances stop growing at `max` (anything farther
 * is reported as max + 1).
 */
export function shoreDistance(rgba: Uint8ClampedArray | number[], w: number, h: number, max: number): Uint8Array {
  const far = max + 1;
  const d = new Uint8Array(w * h);
  const queue: number[] = [];
  for (let i = 0; i < w * h; i++) {
    const water = isWaterPixel(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2], rgba[i * 4 + 3]);
    d[i] = water ? far : 0;
  }
  // Seed: water pixels touching a non-water pixel inside the frame.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      const touches = (x > 0 && d[i - 1] === 0) || (x < w - 1 && d[i + 1] === 0) || (y > 0 && d[i - w] === 0) || (y < h - 1 && d[i + w] === 0);
      if (touches) {
        d[i] = 1;
        queue.push(i);
      }
    }
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const next = d[i] + 1;
    if (next > max) continue;
    const x = i % w;
    const y = (i - x) / w;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
      if (j >= 0 && d[j] > next) {
        d[j] = next;
        queue.push(j);
      }
    }
  }
  return d;
}

/**
 * Foam mask for one band: 1 where a water pixel's bank distance is inside
 * `band`. `sparse` keeps every other pixel in a checker so the far band reads
 * as broken spray rather than a solid line.
 */
export function foamMask(dist: Uint8Array, w: number, band: [number, number], sparse: boolean): Uint8Array {
  const m = new Uint8Array(dist.length);
  for (let i = 0; i < dist.length; i++) {
    const v = dist[i];
    if (v < band[0] || v > band[1] || v === 0) continue;
    if (sparse) {
      const x = i % w;
      const y = (i - x) / w;
      if ((x + y) % 2 === 1) continue;
    }
    m[i] = 1;
  }
  return m;
}
