/** Whether a place can be entered yet. */
export type PlaceStatus = 'open' | 'soon';

/** A place on the town map; x/y are the marker position in map pixels. */
export interface Place {
  id: string;
  x: number;
  y: number;
  status: PlaceStatus;
  /** Scene to open when entered (open places only). */
  scene?: string;
}

/** A validated town map. */
export interface TownMap {
  background: string;
  width: number;
  height: number;
  /** Place selected when the map opens. */
  start: string;
  places: Place[];
}

/** Arrow directions for map navigation. */
export type NavDir = 'up' | 'down' | 'left' | 'right';

type Obj = Record<string, unknown>;

function fail(path: string, msg: string): never {
  throw new Error(`Invalid map at ${path}: ${msg}`);
}

function obj(v: unknown, path: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(path, 'expected object');
  return v as Obj;
}

function num(o: Obj, k: string, path: string, min = -Infinity): number {
  const v = o[k];
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min) fail(`${path}.${k}`, `expected number >= ${min}`);
  return v;
}

function str(o: Obj, k: string, path: string): string {
  const v = o[k];
  if (typeof v !== 'string' || v === '') fail(`${path}.${k}`, 'expected non-empty string');
  return v;
}

/**
 * Validates raw map JSON (src/data/map.json). Every place must sit on the
 * picture, ids must be unique, open places must name a scene, and `start`
 * must be one of the places. Throws an Error naming the bad field.
 */
export function parseMap(raw: unknown): TownMap {
  const o = obj(raw, 'map');
  const width = num(o, 'width', 'map', 1);
  const height = num(o, 'height', 'map', 1);
  if (!Array.isArray(o.places) || o.places.length === 0) fail('map.places', 'expected a non-empty array');
  const seen = new Set<string>();
  const places = (o.places as unknown[]).map((e, i): Place => {
    const p = `map.places[${i}]`;
    const po = obj(e, p);
    const id = str(po, 'id', p);
    if (seen.has(id)) fail(p, `duplicate id "${id}"`);
    seen.add(id);
    const x = num(po, 'x', p, 0);
    const y = num(po, 'y', p, 0);
    if (x > width || y > height) fail(p, 'must lie on the map picture');
    const status = po.status;
    if (status !== 'open' && status !== 'soon') fail(`${p}.status`, "expected 'open' or 'soon'");
    const place: Place = { id, x, y, status };
    if (status === 'open') place.scene = str(po, 'scene', p);
    return place;
  });
  const start = str(o, 'start', 'map');
  if (!seen.has(start)) fail('map.start', `unknown place "${start}"`);
  return { background: str(o, 'background', 'map'), width, height, start, places };
}

const DIRS: Record<NavDir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/**
 * The place an arrow press moves to from `from`: among places lying in that
 * direction (within 90° of it), the one closest once off-axis distance is
 * penalised, so "right" prefers a place straight right over a nearer one far
 * above. Returns `from` when nothing lies that way.
 */
export function navigate(places: Place[], from: string, dir: NavDir): string {
  const cur = places.find((p) => p.id === from);
  if (!cur) return from;
  const d = DIRS[dir];
  let best = from;
  let bestScore = Infinity;
  for (const p of places) {
    if (p.id === from) continue;
    const dx = p.x - cur.x;
    const dy = p.y - cur.y;
    const along = dx * d.x + dy * d.y;
    if (along <= 0) continue;
    const across = Math.abs(dx * d.y - dy * d.x);
    if (across > along * 2) continue; // more sideways than forwards (beyond ~63°)
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = p.id;
    }
  }
  return best;
}
