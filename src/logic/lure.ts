/**
 * Catching with bait (design: user decisions 2026-11-15): put bait on the
 * ground; a creature that notices it comes over carefully, stopping now and
 * then to look around. Moving while it looks, or standing too close, scares it
 * off. While it eats you sneak up and press E, then win the tension minigame
 * (src/logic/tension.ts). Losing, or scaring it, costs the bait.
 * Data: src/data/lure.json. Render-independent so the server can share it.
 */
import type { TensionTuning } from './tension';

/** How a species behaves around bait. */
export interface Temper {
  /** Time between looks around (ms), random in range. */
  lookEveryMs: [number, number];
  /** How long one look lasts (ms), random in range. */
  lookMs: [number, number];
  /** Approach speed (px/s). */
  speed: number;
  /** Closer than this (px) to the creature while it comes over and it runs. */
  fleeDistance: number;
}

export interface LureRules {
  /** A creature this close (px) to bait it accepts notices it. */
  noticeRadius: number;
  /** Its own bait is noticed from this many times farther. */
  specificNoticeBonus: number;
  /** Its own bait widens the minigame's catch zone this many times. */
  specificZoneBonus: number;
  /** Bait nobody came for is given back after this long (ms). */
  waitMs: number;
  /** How long a creature eats (ms): the window to sneak up and press E. */
  eatMs: [number, number];
  defaultTemper: string;
  tempers: Record<string, Temper>;
  /** Species id -> temper name (others use defaultTemper). */
  species: Record<string, string>;
  /** Rarity id -> minigame tuning. */
  tension: Record<string, TensionTuning>;
}

/** Why a creature ran from the bait. */
export type Spook = 'moved' | 'too_close';

const fail = (path: string, msg: string): never => {
  throw new Error(`lure.json ${path}: ${msg}`);
};
const obj = (v: unknown, path: string): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : fail(path, 'expected an object'));
const num = (o: Record<string, unknown>, k: string, path: string, min = 0): number => {
  const v = o[k];
  return typeof v === 'number' && Number.isFinite(v) && v >= min ? v : fail(`${path}.${k}`, `expected a number >= ${min}`);
};
const range = (o: Record<string, unknown>, k: string, path: string): [number, number] => {
  const v = o[k];
  if (!Array.isArray(v) || v.length !== 2 || typeof v[0] !== 'number' || typeof v[1] !== 'number' || v[0] < 0 || v[0] > v[1]) return fail(`${path}.${k}`, 'expected [min, max]');
  return [v[0], v[1]];
};

/** Validates lure.json; every rarity in `rarityIds` needs minigame tuning. Throws with the offending path. */
export function parseLureRules(json: unknown, rarityIds: string[]): LureRules {
  const o = obj(json, '(root)');
  const to = obj(o.tempers, 'tempers');
  const tempers: Record<string, Temper> = {};
  for (const [name, v] of Object.entries(to)) {
    const p = `tempers.${name}`;
    const t = obj(v, p);
    tempers[name] = { lookEveryMs: range(t, 'lookEveryMs', p), lookMs: range(t, 'lookMs', p), speed: num(t, 'speed', p, 1), fleeDistance: num(t, 'fleeDistance', p) };
  }
  const defaultTemper = typeof o.defaultTemper === 'string' && tempers[o.defaultTemper] ? o.defaultTemper : fail('defaultTemper', 'expected a temper name');
  const so = obj(o.species, 'species');
  const species: Record<string, string> = {};
  for (const [id, name] of Object.entries(so)) {
    if (typeof name !== 'string' || !tempers[name]) fail(`species.${id}`, 'expected a temper name');
    species[id] = name as string;
  }
  const xo = obj(o.tension, 'tension');
  const tension: Record<string, TensionTuning> = {};
  for (const r of rarityIds) {
    const p = `tension.${r}`;
    const t = obj(xo[r], p);
    const zoneWidth = num(t, 'zoneWidth', p);
    if (zoneWidth <= 0 || zoneWidth > 1) fail(`${p}.zoneWidth`, 'expected 0-1');
    const start = num(t, 'start', p);
    if (start <= 0 || start >= 1) fail(`${p}.start`, 'expected between 0 and 1');
    tension[r] = {
      zoneWidth,
      zoneSpeed: num(t, 'zoneSpeed', p),
      jumpEveryMs: range(t, 'jumpEveryMs', p),
      lift: num(t, 'lift', p),
      gravity: num(t, 'gravity', p),
      fill: num(t, 'fill', p),
      drain: num(t, 'drain', p),
      start,
      maxMs: num(t, 'maxMs', p, 1),
      graceMs: num(t, 'graceMs', p),
    };
  }
  return {
    noticeRadius: num(o, 'noticeRadius', '(root)', 1),
    specificNoticeBonus: num(o, 'specificNoticeBonus', '(root)', 1),
    specificZoneBonus: num(o, 'specificZoneBonus', '(root)', 1),
    waitMs: num(o, 'waitMs', '(root)', 1),
    eatMs: range(o, 'eatMs', '(root)'),
    defaultTemper,
    tempers,
    species,
    tension,
  };
}

/** How a species behaves around bait. */
export function temperOf(rules: LureRules, speciesId: string): Temper {
  return rules.tempers[rules.species[speciesId] ?? rules.defaultTemper];
}

/** How far away (px) a creature notices bait: farther when it is its own favourite. */
export function noticeRadius(rules: LureRules, specific: boolean): number {
  return rules.noticeRadius * (specific ? rules.specificNoticeBonus : 1);
}

/**
 * While a creature comes to the bait: does it get scared? Standing too close
 * always does; moving only while it is looking around ("red light, green light").
 */
export function spooked(temper: Temper, s: { looking: boolean; playerMoving: boolean; playerDistance: number }): Spook | null {
  if (s.playerDistance < temper.fleeDistance) return 'too_close';
  if (s.looking && s.playerMoving) return 'moved';
  return null;
}

/** Minigame tuning for a species' rarity, with the zone widened for its own bait. */
export function tensionFor(rules: LureRules, rarity: string, specific: boolean): TensionTuning {
  const base = rules.tension[rarity];
  if (!base) throw new Error(`No minigame tuning for rarity "${rarity}"`);
  return specific ? { ...base, zoneWidth: Math.min(1, base.zoneWidth * rules.specificZoneBonus) } : base;
}
