import { gameHoursToMs, parseTimeConfig } from './gameTime';
import { COINS_PRODUCT } from './work';
import { RARITIES, TIMES_OF_DAY, WEATHER_NEEDS, type Config, type Item, type Shop, type Species, type StartConfig } from './types';

type Obj = Record<string, unknown>;

function fail(path: string, msg: string): never {
  throw new Error(`Invalid config at ${path}: ${msg}`);
}

function obj(v: unknown, path: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(path, 'expected object');
  return v as Obj;
}

function arr(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(path, 'expected array');
  return v;
}

function str(o: Obj, k: string, path: string): string {
  const v = o[k];
  if (typeof v !== 'string' || v === '') fail(`${path}.${k}`, 'expected non-empty string');
  return v;
}

function num(o: Obj, k: string, path: string, opts: { min?: number; int?: boolean } = {}): number {
  const v = o[k];
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(`${path}.${k}`, 'expected finite number');
  if (opts.int && !Number.isInteger(v)) fail(`${path}.${k}`, 'expected integer');
  if (opts.min !== undefined && v < opts.min) fail(`${path}.${k}`, `must be >= ${opts.min}`);
  return v;
}

function oneOf<T extends string>(o: Obj, k: string, path: string, allowed: readonly T[]): T {
  const v = o[k];
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) fail(`${path}.${k}`, `expected one of ${allowed.join(', ')}`);
  return v as T;
}

function numberMap(v: unknown, path: string): Record<string, number> {
  const o = obj(v, path);
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(o)) {
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) fail(`${path}.${k}`, 'expected number >= 0');
    out[k] = n;
  }
  return out;
}

function uniqueIds(list: { id: string }[], path: string): void {
  const seen = new Set<string>();
  for (const e of list) {
    if (seen.has(e.id)) fail(path, `duplicate id "${e.id}"`);
    seen.add(e.id);
  }
}

/**
 * Validates raw JSON (the contents of the src/data files) and returns typed,
 * cross-checked config. Throws an Error naming the bad field; bad config is a
 * developer error, unlike a bad save.
 * @example const config = parseConfig({ species, shops, items, start });
 */
export function parseConfig(raw: { species: unknown; shops: unknown; items: unknown; start: unknown; time: unknown }): Config {
  const time = parseTimeConfig(raw.time);
  const species: Species[] = arr(raw.species, 'species').map((e, i) => {
    const p = `species[${i}]`;
    const o = obj(e, p);
    const areas = arr(o.areas, `${p}.areas`).map((a, j) => {
      if (typeof a !== 'string' || a === '') fail(`${p}.areas[${j}]`, 'expected area id');
      return a;
    });
    if (areas.length === 0) fail(`${p}.areas`, 'needs at least one area');
    if (o.food !== null && typeof o.food !== 'string') fail(`${p}.food`, 'expected item id or null');
    if (o.generalist !== undefined && typeof o.generalist !== 'boolean') fail(`${p}.generalist`, 'expected boolean');
    return {
      id: str(o, 'id', p),
      name: str(o, 'name', p),
      rarity: oneOf(o, 'rarity', p, RARITIES),
      areas,
      time: oneOf(o, 'time', p, TIMES_OF_DAY),
      weather: oneOf(o, 'weather', p, WEATHER_NEEDS),
      baseProduction: num(o, 'baseProduction', p, { min: 0 }),
      maxEnergy: num(o, 'maxEnergy', p, { min: 1 }),
      energyCost: num(o, 'energyCost', p, { min: 0 }),
      food: (o.food as string | null) ?? null,
      baitId: str(o, 'baitId', p),
      affinities: numberMap(o.affinities, `${p}.affinities`),
      generalist: o.generalist === true,
      reason: str(o, 'reason', p),
    };
  });
  const shops: Shop[] = arr(raw.shops, 'shops').map((e, i) => {
    const p = `shops[${i}]`;
    const o = obj(e, p);
    const shiftHours = num(o, 'shiftHours', p, { min: 0 });
    if (shiftHours <= 0) fail(`${p}.shiftHours`, 'must be > 0');
    return {
      id: str(o, 'id', p),
      name: str(o, 'name', p),
      slots: num(o, 'slots', p, { min: 1, int: true }),
      shiftHours,
      shiftMs: gameHoursToMs(shiftHours, time),
      productItemId: str(o, 'productItemId', p),
      rate: num(o, 'rate', p, { min: 0 }),
      energyCost: num(o, 'energyCost', p, { min: 0 }),
    };
  });
  const items: Item[] = arr(raw.items, 'items').map((e, i) => {
    const p = `items[${i}]`;
    const o = obj(e, p);
    for (const k of ['buyable', 'sellable']) if (o[k] !== undefined && typeof o[k] !== 'boolean') fail(`${p}.${k}`, 'expected boolean');
    const item: Item = { id: str(o, 'id', p), name: str(o, 'name', p), price: num(o, 'price', p, { min: 0 }), buyable: o.buyable === true, sellable: o.sellable === true };
    if (o.energyRestore !== undefined) item.energyRestore = num(o, 'energyRestore', p, { min: 0 });
    return item;
  });
  const so = obj(raw.start, 'start');
  const start: StartConfig = {
    coins: num(so, 'coins', 'start', { min: 0 }),
    inventory: numberMap(so.inventory, 'start.inventory'),
    creatures: arr(so.creatures, 'start.creatures').map((s, i) => {
      if (typeof s !== 'string') fail(`start.creatures[${i}]`, 'expected species id string');
      return s;
    }),
  };

  uniqueIds(species, 'species');
  uniqueIds(shops, 'shops');
  uniqueIds(items, 'items');
  if (items.some((i) => i.id === COINS_PRODUCT)) fail('items', `"${COINS_PRODUCT}" is reserved for coin-paying workplaces`);
  const itemIds = new Set(items.map((i) => i.id));
  const speciesIds = new Set(species.map((s) => s.id));
  const shopIds = new Set(shops.map((s) => s.id));
  for (const s of shops) if (s.productItemId !== COINS_PRODUCT && !itemIds.has(s.productItemId)) fail(`shops.${s.id}.productItemId`, `unknown item "${s.productItemId}"`);
  for (const s of species) {
    for (const k of Object.keys(s.affinities)) if (!shopIds.has(k)) fail(`species.${s.id}.affinities`, `unknown shop "${k}"`);
    if (!itemIds.has(s.baitId)) fail(`species.${s.id}.baitId`, `unknown item "${s.baitId}"`);
    if (s.food !== null && !itemIds.has(s.food)) fail(`species.${s.id}.food`, `unknown item "${s.food}"`);
    // design/creatures.md rule 3: every creature has a strength and a weakness (the generalist excepted).
    const m = Object.values(s.affinities);
    if (!s.generalist && !m.some((x) => x > 1)) fail(`species.${s.id}.affinities`, 'needs at least one strength (> 1)');
    if (!s.generalist && !m.some((x) => x < 1)) fail(`species.${s.id}.affinities`, 'needs at least one weakness (< 1)');
  }
  for (const k of Object.keys(start.inventory)) if (!itemIds.has(k)) fail('start.inventory', `unknown item "${k}"`);
  for (const id of start.creatures) if (!speciesIds.has(id)) fail('start.creatures', `unknown species "${id}"`);

  return { species, shops, items, start, time };
}
