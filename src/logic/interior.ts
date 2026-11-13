import { rect, type ExitDef, type FloorPlan, type Rect } from './room';

/** One furniture piece cut out of a painted room (PixelLab create_room layers). */
export interface InteriorPiece {
  /** File number: assets/interiors/<dir>/piece_<n>.png (and shadow_<n>.png). */
  n: string;
  /** Top-left of the picture in room pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Lowest opaque row: where it stands on the floor; it depth-sorts by this. */
  foot: number;
  /** Top-left of its shadow picture, or null if it casts none. */
  shadow: { x: number; y: number } | null;
  /** The floor it blocks (room pixels), or null when it can be walked behind and over. */
  block: Rect | null;
}

/** Facing a worker takes at its station, towards the furniture it works at. */
export type Face = 'up' | 'down' | 'left' | 'right';
const FACES: Face[] = ['up', 'down', 'left', 'right'];

/** Where a working creature stands, up against the furniture it works at; one per shop slot, in slot order. */
export interface Station {
  x: number;
  y: number;
  face: Face;
}

/** Puffs that rise from the furniture while someone works (flour, sawdust, dust). */
export interface WorkEffect {
  color: string;
  everyMs: number;
}

/** A building's inside: painted floor, cut-out furniture, walls, the way out and its work stations. */
export interface InteriorDef extends FloorPlan {
  id: string;
  /** Workplace in shops.json this building runs. */
  shopId: string;
  /** Folder under public/assets/interiors/. */
  dir: string;
  pieces: InteriorPiece[];
  stations: Station[];
  exits: ExitDef[];
  effect: WorkEffect;
  /** A shop counter the player trades at (the market), or null. */
  counter: Counter | null;
  /** Texture tiled around the room picture (public/assets/backdrops/<key>.png), or null. */
  backdrop: string | null;
}

/** Where the player trades, and what the shelves stock (item ids, one menu per shelf). */
export interface Counter {
  x: number;
  y: number;
  shelves: { id: string; items: string[] }[];
}

type Obj = Record<string, unknown>;

function fail(path: string, msg: string): never {
  throw new Error(`Invalid interior at ${path}: ${msg}`);
}

function obj(v: unknown, path: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(path, 'expected object');
  return v as Obj;
}

function num(o: Obj, k: string, path: string, min = -Infinity): number {
  const v = o[k];
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(`${path}.${k}`, 'expected finite number');
  if (v < min) fail(`${path}.${k}`, `must be >= ${min}`);
  return v;
}

function str(o: Obj, k: string, path: string): string {
  const v = o[k];
  if (typeof v !== 'string' || v === '') fail(`${path}.${k}`, 'expected non-empty string');
  return v;
}

function list(o: Obj, k: string, path: string): unknown[] {
  if (!Array.isArray(o[k])) fail(`${path}.${k}`, 'expected array');
  return o[k] as unknown[];
}

/**
 * The floor a piece blocks: its full width (minus `inset` each side) and
 * `depth` px up from its foot, so the player walks behind its upper part.
 */
export function pieceBlock(p: { x: number; w: number; foot: number }, depth: number, inset: number): Rect {
  return { x: p.x + inset, y: p.foot - depth, w: Math.max(1, p.w - inset * 2), h: depth };
}

/**
 * Validates src/data/interiors.json (an object of building id -> interior) and
 * cross-checks it: every shopId must exist and have exactly as many stations
 * as the shop has slots. Throws an Error naming the bad field.
 * @example const interiors = parseInteriors(json, config.shops);
 */
export function parseInteriors(raw: unknown, shops: { id: string; slots: number }[], buyable: string[] = []): Record<string, InteriorDef> {
  const root = obj(raw, 'interiors');
  const out: Record<string, InteriorDef> = {};
  for (const [id, v] of Object.entries(root)) {
    const p = `interiors.${id}`;
    const o = obj(v, p);
    const width = num(o, 'width', p, 1);
    const height = num(o, 'height', p, 1);
    const gridSize = num(o, 'gridSize', p, 1);
    if (width % gridSize !== 0 || height % gridSize !== 0) fail(`${p}.gridSize`, 'must divide width and height');
    const blockDepth = num(o, 'blockDepth', p, 1);
    const blockInset = num(o, 'blockInset', p, 0);
    const walkable = list(o, 'walkable', p).map((r, i) => rect(r, `${p}.walkable[${i}]`, width, height));
    if (walkable.length === 0) fail(`${p}.walkable`, 'expected a non-empty array');
    const exits: ExitDef[] = list(o, 'exits', p).map((e, i) => {
      const ep = `${p}.exits[${i}]`;
      const x = obj(e, ep);
      const a = obj(x.arrive, `${ep}.arrive`);
      return { to: str(x, 'to', ep), rect: rect(x.rect, `${ep}.rect`, width, height), arrive: { x: num(a, 'x', `${ep}.arrive`), y: num(a, 'y', `${ep}.arrive`) } };
    });
    if (exits.length === 0) fail(`${p}.exits`, 'needs a way out');
    const pieces: InteriorPiece[] = list(o, 'pieces', p).map((e, i) => {
      const pp = `${p}.pieces[${i}]`;
      const x = obj(e, pp);
      const piece = { n: str(x, 'n', pp), x: num(x, 'x', pp), y: num(x, 'y', pp), w: num(x, 'w', pp, 1), h: num(x, 'h', pp, 1), foot: num(x, 'foot', pp) };
      const s = x.shadow === undefined ? null : obj(x.shadow, `${pp}.shadow`);
      const solid = x.solid === undefined ? true : x.solid;
      if (typeof solid !== 'boolean') fail(`${pp}.solid`, 'expected boolean');
      const depth = x.blockDepth === undefined ? blockDepth : num(x, 'blockDepth', pp, 1);
      return {
        ...piece,
        shadow: s ? { x: num(s, 'x', `${pp}.shadow`), y: num(s, 'y', `${pp}.shadow`) } : null,
        block: solid ? pieceBlock(piece, depth, blockInset) : null,
      };
    });
    const stations: Station[] = list(o, 'stations', p).map((e, i) => {
      const sp = `${p}.stations[${i}]`;
      const x = obj(e, sp);
      const face = x.face as Face;
      if (!FACES.includes(face)) fail(`${sp}.face`, `expected one of ${FACES.join(', ')}`);
      const st = { x: num(x, 'x', sp, 0), y: num(x, 'y', sp, 0), face };
      if (!walkable.some((r) => st.x >= r.x && st.x < r.x + r.w && st.y >= r.y && st.y < r.y + r.h)) fail(sp, 'must stand on walkable floor');
      return st;
    });
    const shopId = str(o, 'shopId', p);
    const shop = shops.find((s) => s.id === shopId);
    if (!shop) fail(`${p}.shopId`, `unknown shop "${shopId}"`);
    if (stations.length !== shop.slots) fail(`${p}.stations`, `expected ${shop.slots} (the shop's slots), got ${stations.length}`);
    const eo = obj(o.effect, `${p}.effect`);
    const color = str(eo, 'color', `${p}.effect`);
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) fail(`${p}.effect.color`, 'expected #rrggbb');
    const effect = { color, everyMs: num(eo, 'everyMs', `${p}.effect`, 50) };
    let counter: Counter | null = null;
    if (o.counter !== undefined) {
      const cp = `${p}.counter`;
      const c = obj(o.counter, cp);
      const shelves = list(c, 'shelves', cp).map((s, i) => {
        const sp = `${cp}.shelves[${i}]`;
        const so = obj(s, sp);
        const items = list(so, 'items', sp).map((it, j) => {
          if (typeof it !== 'string' || !buyable.includes(it)) fail(`${sp}.items[${j}]`, 'expected an item the market sells');
          return it;
        });
        return { id: str(so, 'id', sp), items };
      });
      counter = { x: num(c, 'x', cp, 0), y: num(c, 'y', cp, 0), shelves };
    }
    const backdrop = o.backdrop === undefined ? null : str(o, 'backdrop', p);
    out[id] = { id, shopId, dir: str(o, 'dir', p), width, height, gridSize, walkable, exits, pieces, stations, effect, counter, backdrop };
  }
  return out;
}

/** Index of the station within `range` px of `pos` that is closest, or -1. */
export function stationNear(def: InteriorDef, pos: { x: number; y: number }, range: number): number {
  let best = -1;
  let bestD = range;
  def.stations.forEach((s, i) => {
    const d = Math.hypot(s.x - pos.x, s.y - pos.y);
    if (d <= bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

/** How far (px) in front of a worker its hands reach the furniture. */
export const WORK_REACH = 14;

/** The point a worker at `s` works on: a little way off in the direction it faces. */
export function workPoint(s: Station, reach: number): { x: number; y: number } {
  const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[s.face];
  // Sprites stand on their feet; the hands are about half a body up.
  return { x: s.x + d[0] * reach, y: s.y - reach + d[1] * reach };
}

/** Formats real ms left as m:ss for countdowns. */
export function formatCountdown(ms: number): string {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
