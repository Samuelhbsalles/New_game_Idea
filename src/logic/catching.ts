import type { Game } from './game';
import { RARITIES, type Creature, type Rarity, type Species } from './types';

/** How a rarity tier appears and is caught (design/creatures.md, "Níveis de raridade"). */
export interface RarityRule {
  /** Relative weight when picking which eligible species appears. */
  weight: number;
  /** Catch chance with the species' own bait. */
  specific: number;
  /** Catch chance with the generic bait (0 = the generic bait does not work). */
  generic: number;
}

/** A neighbourhood creatures live in, and where (if anywhere) it is in the town. */
export interface AreaRule {
  id: string;
  /** Spawn rectangle in town pixels, or null when the area is not in the town yet (lake, shore...). */
  inTown: { x: number; y: number; w: number; h: number } | null;
  /** Most wild creatures out at once in this area. */
  max: number;
  /** Wait between appearances (ms). */
  everyMs: [number, number];
}

/** Catching rules (src/data/catching.json). */
export interface CatchRules {
  /** Bait that works on any species whose rarity allows it (commons). */
  genericBaitId: string;
  /** How close (px) the player must be to try. */
  catchRange: number;
  rarities: Record<Rarity, RarityRule>;
  areas: Record<string, AreaRule>;
}

/** Conditions right now that decide who is out. */
export interface SpawnContext {
  night: boolean;
  /** Current weather; 'clear' until a weather system exists. */
  weather: string;
}

/** What a catch attempt did. */
export type CatchResult =
  | { ok: true; creature: Creature; firstOfSpecies: boolean; baitUsed: string }
  | { ok: false; reason: 'escaped'; baitUsed: string }
  | { ok: false; reason: 'no_bait'; needs: string }
  | { ok: false; reason: 'not_catchable' };

type Obj = Record<string, unknown>;

function fail(path: string, msg: string): never {
  throw new Error(`Invalid catching rules at ${path}: ${msg}`);
}

function obj(v: unknown, path: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(path, 'expected object');
  return v as Obj;
}

function num(o: Obj, k: string, path: string, min = 0, max = Infinity): number {
  const v = o[k];
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) fail(`${path}.${k}`, `expected number in [${min}, ${max}]`);
  return v;
}

/**
 * Validates src/data/catching.json against the species and item ids: every
 * rarity has a rule, chances lie in [0, 1], and every area a species names exists.
 * Throws naming the bad field.
 */
export function parseCatchRules(raw: unknown, species: Species[], itemIds: string[]): CatchRules {
  const o = obj(raw, 'catching');
  if (typeof o.genericBaitId !== 'string' || !itemIds.includes(o.genericBaitId)) fail('catching.genericBaitId', 'expected a known item id');
  const ro = obj(o.rarities, 'catching.rarities');
  const rarities = {} as Record<Rarity, RarityRule>;
  for (const r of RARITIES) {
    const p = `catching.rarities.${r}`;
    const x = obj(ro[r], p);
    rarities[r] = { weight: num(x, 'weight', p), specific: num(x, 'specific', p, 0, 1), generic: num(x, 'generic', p, 0, 1) };
  }
  const ao = obj(o.areas, 'catching.areas');
  const areas: Record<string, AreaRule> = {};
  for (const [id, v] of Object.entries(ao)) {
    const p = `catching.areas.${id}`;
    const x = obj(v, p);
    let inTown: AreaRule['inTown'] = null;
    if (x.inTown !== null) {
      const a = obj(x.inTown, `${p}.inTown`);
      inTown = { x: num(a, 'x', `${p}.inTown`), y: num(a, 'y', `${p}.inTown`), w: num(a, 'w', `${p}.inTown`, 1), h: num(a, 'h', `${p}.inTown`, 1) };
    }
    const e = x.everyMs;
    if (!Array.isArray(e) || e.length !== 2 || !e.every((n) => typeof n === 'number' && n >= 0) || e[0] > e[1]) fail(`${p}.everyMs`, 'expected [min, max]');
    areas[id] = { id, inTown, max: num(x, 'max', p, 0), everyMs: [e[0], e[1]] };
  }
  for (const s of species) for (const a of s.areas) if (!(a in areas)) fail(`species.${s.id}.areas`, `unknown area "${a}"`);
  return { genericBaitId: o.genericBaitId, catchRange: num(o, 'catchRange', 'catching', 1), rarities, areas };
}

/** Species that can be out in `areaId` now: right area, right time of day, right weather. */
export function eligibleSpecies(species: Species[], areaId: string, ctx: SpawnContext): Species[] {
  return species.filter(
    (s) =>
      s.areas.includes(areaId) &&
      (s.time === 'any' || (s.time === 'night') === ctx.night) &&
      (s.weather === 'any' || s.weather === ctx.weather),
  );
}

/**
 * Picks which species appears, weighted by rarity (common ~60, uncommon ~25,
 * rare ~10, epic ~4 out of the eligible ones). Null when none is eligible.
 */
export function pickSpawn(rules: CatchRules, candidates: Species[], rng: () => number): Species | null {
  const total = candidates.reduce((t, s) => t + rules.rarities[s.rarity].weight, 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const s of candidates) {
    r -= rules.rarities[s.rarity].weight;
    if (r < 0) return s;
  }
  return candidates[candidates.length - 1];
}

/**
 * The bait the player would use on a species and its catch chance: the
 * species' own bait if they hold one, else the generic bait if this rarity
 * accepts it, else null.
 */
export function baitFor(game: Game, rules: CatchRules, speciesId: string): { itemId: string; chance: number } | null {
  const species = game.config.species.find((s) => s.id === speciesId);
  if (!species) return null;
  const rule = rules.rarities[species.rarity];
  const has = (id: string) => (game.state.inventory[id] ?? 0) > 0;
  if (has(species.baitId)) return { itemId: species.baitId, chance: rule.specific };
  if (rule.generic > 0 && has(rules.genericBaitId)) return { itemId: rules.genericBaitId, chance: rule.generic };
  return null;
}

/** The lowest unused creature id of the form c1, c2, ... */
function nextCreatureId(game: Game): string {
  const used = new Set(game.state.creatures.map((c) => c.id));
  let n = 1;
  while (used.has(`c${n}`)) n++;
  return `c${n}`;
}

/**
 * Tries to catch a wild creature of `speciesId`.
 * - No usable bait: nothing changes, reason 'no_bait' with the species' own bait in `needs`.
 * - Otherwise one bait is used (its own bait first, see baitFor), then the
 *   rarity's chance decides: success adds a full-energy idle creature and
 *   records the species in the album; failure is 'escaped'.
 * Does not save; the caller saves after a change.
 */
export function attemptCatch(game: Game, rules: CatchRules, speciesId: string, rng: () => number): CatchResult {
  const species = game.config.species.find((s) => s.id === speciesId);
  if (!species) return { ok: false, reason: 'not_catchable' };
  const bait = baitFor(game, rules, speciesId);
  if (!bait) return { ok: false, reason: 'no_bait', needs: species.baitId };
  game.state.inventory[bait.itemId] -= 1;
  if (rng() >= bait.chance) return { ok: false, reason: 'escaped', baitUsed: bait.itemId };
  const creature: Creature = { id: nextCreatureId(game), speciesId, energy: species.maxEnergy, energyAt: game.clock.now(), status: 'idle' };
  game.state.creatures.push(creature);
  const caught = (game.state.caught ??= []);
  const firstOfSpecies = !caught.includes(speciesId);
  if (firstOfSpecies) caught.push(speciesId);
  return { ok: true, creature, firstOfSpecies, baitUsed: bait.itemId };
}

/** How many generic baits the player has. */
export function baitCount(game: Game, rules: CatchRules): number {
  return game.state.inventory[rules.genericBaitId] ?? 0;
}

/**
 * Per workplace, the species good at it (multiplier > 1) and bad at it (< 1),
 * strongest first: design/creatures.md "Cobertura por comércio".
 */
export function coverage(species: Species[], shopIds: string[]): Record<string, { strong: string[]; weak: string[] }> {
  const out: Record<string, { strong: string[]; weak: string[] }> = {};
  for (const shop of shopIds) {
    const by = (pred: (m: number) => boolean) =>
      species
        .filter((s) => pred(s.affinities[shop] ?? 1))
        .sort((a, b) => (b.affinities[shop] ?? 1) - (a.affinities[shop] ?? 1))
        .map((s) => s.id);
    out[shop] = { strong: by((m) => m > 1), weak: by((m) => m < 1) };
  }
  return out;
}
