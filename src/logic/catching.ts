import type { Game } from './game';
import type { Creature } from './types';

/** Where and how often a wild species appears. */
export interface SpawnRule {
  species: string;
  area: { x: number; y: number; w: number; h: number };
  /** Most of this species out at once. */
  max: number;
  /** Wait between appearances (ms). */
  everyMs: [number, number];
}

/** Catching rules (src/data/catching.json). */
export interface CatchRules {
  baitItemId: string;
  /** How close (px) the player must be to try. */
  catchRange: number;
  /** Chance a bait catch succeeds, per species (1 = always). */
  species: Record<string, { chance: number }>;
  spawns: SpawnRule[];
}

/** What a catch attempt did. */
export type CatchResult =
  | { ok: true; creature: Creature; firstOfSpecies: boolean }
  | { ok: false; reason: 'no_bait' | 'escaped' | 'not_catchable' };

type Obj = Record<string, unknown>;

function fail(path: string, msg: string): never {
  throw new Error(`Invalid catching rules at ${path}: ${msg}`);
}

function obj(v: unknown, path: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(path, 'expected object');
  return v as Obj;
}

function num(o: Obj, k: string, path: string, min = 0): number {
  const v = o[k];
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min) fail(`${path}.${k}`, `expected number >= ${min}`);
  return v;
}

/**
 * Validates src/data/catching.json against the known species ids.
 * Chances must be within [0, 1]. Throws naming the bad field.
 */
export function parseCatchRules(raw: unknown, speciesIds: string[]): CatchRules {
  const o = obj(raw, 'catching');
  if (typeof o.baitItemId !== 'string' || o.baitItemId === '') fail('catching.baitItemId', 'expected item id');
  const so = obj(o.species, 'catching.species');
  const species: CatchRules['species'] = {};
  for (const [id, v] of Object.entries(so)) {
    if (!speciesIds.includes(id)) fail(`catching.species.${id}`, 'unknown species');
    const chance = num(obj(v, `catching.species.${id}`), 'chance', `catching.species.${id}`);
    if (chance > 1) fail(`catching.species.${id}.chance`, 'must be <= 1');
    species[id] = { chance };
  }
  if (!Array.isArray(o.spawns)) fail('catching.spawns', 'expected array');
  const spawns = (o.spawns as unknown[]).map((s, i): SpawnRule => {
    const p = `catching.spawns[${i}]`;
    const sp = obj(s, p);
    if (typeof sp.species !== 'string' || !(sp.species in species)) fail(`${p}.species`, 'expected a catchable species');
    const a = obj(sp.area, `${p}.area`);
    const e = sp.everyMs;
    if (!Array.isArray(e) || e.length !== 2 || !e.every((n) => typeof n === 'number' && n >= 0) || e[0] > e[1]) fail(`${p}.everyMs`, 'expected [min, max]');
    return {
      species: sp.species,
      area: { x: num(a, 'x', `${p}.area`), y: num(a, 'y', `${p}.area`), w: num(a, 'w', `${p}.area`, 1), h: num(a, 'h', `${p}.area`, 1) },
      max: num(sp, 'max', p, 1),
      everyMs: [e[0], e[1]],
    };
  });
  return { baitItemId: o.baitItemId, catchRange: num(o, 'catchRange', 'catching', 1), species, spawns };
}

/** The lowest unused creature id of the form c1, c2, ... */
function nextCreatureId(game: Game): string {
  const used = new Set(game.state.creatures.map((c) => c.id));
  let n = 1;
  while (used.has(`c${n}`)) n++;
  return `c${n}`;
}

/**
 * Tries to catch a wild creature of `speciesId` with one bait.
 * - No bait: nothing changes, reason 'no_bait'.
 * - Otherwise one bait is used, then the species' chance decides: success
 *   adds a full-energy, idle creature to the roster and records the species
 *   as caught (for the album); failure is 'escaped'.
 * Does not save; the caller saves after a change.
 */
export function attemptCatch(game: Game, rules: CatchRules, speciesId: string, rng: () => number): CatchResult {
  const rule = rules.species[speciesId];
  const species = game.config.species.find((s) => s.id === speciesId);
  if (!rule || !species) return { ok: false, reason: 'not_catchable' };
  const inv = game.state.inventory;
  if ((inv[rules.baitItemId] ?? 0) <= 0) return { ok: false, reason: 'no_bait' };
  inv[rules.baitItemId] -= 1;
  if (rng() >= rule.chance) return { ok: false, reason: 'escaped' };
  const creature: Creature = { id: nextCreatureId(game), speciesId, energy: species.maxEnergy, energyAt: game.clock.now(), status: 'idle' };
  game.state.creatures.push(creature);
  const caught = (game.state.caught ??= []);
  const firstOfSpecies = !caught.includes(speciesId);
  if (firstOfSpecies) caught.push(speciesId);
  return { ok: true, creature, firstOfSpecies };
}

/** How many baits the player has. */
export function baitCount(game: Game, rules: CatchRules): number {
  return game.state.inventory[rules.baitItemId] ?? 0;
}
