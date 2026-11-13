import { gameHoursToMs, parseTimeConfig } from './gameTime';
import type { Config, Item, Shop, Species, StartConfig } from './types';

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
    return {
      id: str(o, 'id', p),
      name: str(o, 'name', p),
      baseProduction: num(o, 'baseProduction', p, { min: 0 }),
      maxEnergy: num(o, 'maxEnergy', p, { min: 1 }),
      affinities: numberMap(o.affinities, `${p}.affinities`),
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
    };
  });
  const items: Item[] = arr(raw.items, 'items').map((e, i) => {
    const p = `items[${i}]`;
    const o = obj(e, p);
    const item: Item = { id: str(o, 'id', p), name: str(o, 'name', p), price: num(o, 'price', p, { min: 0 }) };
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
  const itemIds = new Set(items.map((i) => i.id));
  const speciesIds = new Set(species.map((s) => s.id));
  const shopIds = new Set(shops.map((s) => s.id));
  for (const s of shops) if (!itemIds.has(s.productItemId)) fail(`shops.${s.id}.productItemId`, `unknown item "${s.productItemId}"`);
  for (const s of species) for (const k of Object.keys(s.affinities)) if (!shopIds.has(k)) fail(`species.${s.id}.affinities`, `unknown shop "${k}"`);
  for (const k of Object.keys(start.inventory)) if (!itemIds.has(k)) fail('start.inventory', `unknown item "${k}"`);
  for (const id of start.creatures) if (!speciesIds.has(id)) fail('start.creatures', `unknown species "${id}"`);

  return { species, shops, items, start, time };
}
