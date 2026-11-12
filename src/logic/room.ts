import { AUTO_ACTIVITIES, TIMED_ACTIVITIES, type AutoActivity, type MsRange, type PetTuning, type TimedActivity } from './petBrain';

/** What a pet can do at a piece of furniture. */
export type UseKind = 'eat' | 'sleep' | 'lounge';

/** How a pet uses a piece of furniture; offsets are from the furniture centre. */
export interface FurnitureUse {
  kind: UseKind;
  dx: number;
  dy: number;
  /** If set, the pet walks to (dx, approachDy) first and hops onto the spot (e.g. a sofa). */
  approachDy?: number;
  /** Bowls: how many food portions fit. */
  capacity?: number;
}

/** A catalog entry: one buyable furniture item. Sizes are the sprite size in px. */
export interface FurnitureItem {
  id: string;
  sprite: string;
  w: number;
  h: number;
  solid: boolean;
  price: number;
  use?: FurnitureUse;
}

/** A furniture item placed in a room; x/y are the sprite centre in pixels. */
export interface Placed extends FurnitureItem {
  x: number;
  y: number;
}

/** Player spawn and movement tuning for a room. */
export interface PlayerDef {
  /** Asset folder/prefix of the player character, e.g. "player". */
  character: string;
  x: number;
  y: number;
  speed: number;
  walkFps: number;
  /** Distance in px at which the player can interact with the pet or furniture. */
  interactRange: number;
}

/** The pet living in this room. */
export interface PetDef {
  /** Id of the owned creature (GameState.creatures) shown here. */
  creatureId: string;
  x: number;
  y: number;
  speed: number;
  walkFps: number;
  foodItemId: string;
  /** How close (px) a following pet stays behind the player. */
  followDistance: number;
  tuning: PetTuning;
}

/** Axis-aligned rectangle in room pixels, top-left based. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A doorway: stepping into `rect` leaves the room towards `to`; coming back lands on `arrive`. */
export interface ExitDef {
  to: string;
  rect: Rect;
  arrive: { x: number; y: number };
}

/** A validated room layout, ready for a scene to draw. */
export interface RoomDef {
  /** Painted room picture (walls, floor, rug, shadows) under assets/home/. */
  background: string;
  width: number;
  height: number;
  /** Cell size (px) of the walkable grid used for wall collision and pet wandering. */
  gridSize: number;
  /** Where feet may go; everything else in the picture is wall. Exits sit inside these. */
  walkable: Rect[];
  exits: ExitDef[];
  furniture: Placed[];
  player: PlayerDef;
  pet: PetDef;
}

/** Where a pet stands to use something, and where it walks first if it must hop on. */
export interface UseSpot {
  item: Placed;
  spot: { x: number; y: number };
  approach: { x: number; y: number } | null;
}

type Obj = Record<string, unknown>;

function fail(path: string, msg: string): never {
  throw new Error(`Invalid room at ${path}: ${msg}`);
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

function obj(v: unknown, path: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(path, 'expected object');
  return v as Obj;
}

const USE_KINDS: UseKind[] = ['eat', 'sleep', 'lounge'];

/**
 * Validates the furniture catalog (src/data/furniture.json).
 * Throws an Error naming the bad field.
 */
export function parseCatalog(raw: unknown): FurnitureItem[] {
  if (!Array.isArray(raw)) fail('catalog', 'expected array');
  const seen = new Set<string>();
  return raw.map((e, i) => {
    const p = `catalog[${i}]`;
    const o = obj(e, p);
    if (typeof o.solid !== 'boolean') fail(`${p}.solid`, 'expected boolean');
    const item: FurnitureItem = {
      id: str(o, 'id', p),
      sprite: str(o, 'sprite', p),
      w: num(o, 'w', p, 1),
      h: num(o, 'h', p, 1),
      solid: o.solid,
      price: num(o, 'price', p, 0),
    };
    if (seen.has(item.id)) fail(p, `duplicate id "${item.id}"`);
    seen.add(item.id);
    if (o.use !== undefined) {
      const u = obj(o.use, `${p}.use`);
      const kind = u.kind as UseKind;
      if (!USE_KINDS.includes(kind)) fail(`${p}.use.kind`, `expected one of ${USE_KINDS.join(', ')}`);
      item.use = { kind, dx: num(u, 'dx', `${p}.use`), dy: num(u, 'dy', `${p}.use`) };
      if (u.approachDy !== undefined) item.use.approachDy = num(u, 'approachDy', `${p}.use`);
      if (u.capacity !== undefined) item.use.capacity = num(u, 'capacity', `${p}.use`, 1);
    }
    return item;
  });
}

/**
 * Validates raw room JSON (src/data/home.json) against the furniture catalog
 * and returns a typed RoomDef. Throws an Error naming the bad field.
 */
export function parseRoom(raw: unknown, catalog: FurnitureItem[]): RoomDef {
  const o = obj(raw, 'room');
  const width = num(o, 'width', 'room', 1);
  const height = num(o, 'height', 'room', 1);
  const gridSize = num(o, 'gridSize', 'room', 1);
  if (width % gridSize !== 0 || height % gridSize !== 0) fail('room.gridSize', 'must divide width and height');
  if (!Array.isArray(o.walkable) || o.walkable.length === 0) fail('room.walkable', 'expected a non-empty array');
  const walkable = (o.walkable as unknown[]).map((r, i) => rect(r, `room.walkable[${i}]`, width, height));
  if (!Array.isArray(o.exits)) fail('room.exits', 'expected array');
  const exits: ExitDef[] = (o.exits as unknown[]).map((e, i) => {
    const p = `room.exits[${i}]`;
    const x = obj(e, p);
    const a = obj(x.arrive, `${p}.arrive`);
    return { to: str(x, 'to', p), rect: rect(x.rect, `${p}.rect`, width, height), arrive: { x: num(a, 'x', `${p}.arrive`), y: num(a, 'y', `${p}.arrive`) } };
  });
  if (!Array.isArray(o.placements)) fail('room.placements', 'expected array');
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const furniture: Placed[] = (o.placements as unknown[]).map((e, i) => {
    const p = `room.placements[${i}]`;
    const f = obj(e, p);
    const id = str(f, 'item', p);
    const item = byId.get(id);
    if (!item) fail(`${p}.item`, `unknown furniture "${id}"`);
    return { ...item, x: num(f, 'x', p), y: num(f, 'y', p) };
  });
  const po = obj(o.player, 'room.player');
  const player: PlayerDef = {
    character: str(po, 'character', 'room.player'),
    x: num(po, 'x', 'room.player'),
    y: num(po, 'y', 'room.player'),
    speed: num(po, 'speed', 'room.player', 0),
    walkFps: num(po, 'walkFps', 'room.player', 1),
    interactRange: num(po, 'interactRange', 'room.player', 1),
  };
  return {
    background: str(o, 'background', 'room'),
    width,
    height,
    gridSize,
    walkable,
    exits,
    furniture,
    player,
    pet: parsePet(o.pet),
  };
}

/** Parses `{x, y, w, h}` and checks it lies inside the room picture. */
function rect(v: unknown, path: string, width: number, height: number): Rect {
  const o = obj(v, path);
  const r = { x: num(o, 'x', path, 0), y: num(o, 'y', path, 0), w: num(o, 'w', path, 1), h: num(o, 'h', path, 1) };
  if (r.x + r.w > width || r.y + r.h > height) fail(path, 'must lie inside the room picture');
  return r;
}

function range(v: unknown, path: string): MsRange {
  if (!Array.isArray(v) || v.length !== 2 || !v.every((n) => typeof n === 'number' && n >= 0) || v[0] > v[1]) {
    fail(path, 'expected [min, max] with 0 <= min <= max');
  }
  return [v[0], v[1]];
}

function parsePet(raw: unknown): PetDef {
  const p = 'room.pet';
  const o = obj(raw, p);
  const t = obj(o.tuning, `${p}.tuning`);
  const d = obj(t.durations, `${p}.tuning.durations`);
  const w = obj(t.weights, `${p}.tuning.weights`);
  const durations = {} as Record<TimedActivity, MsRange>;
  for (const a of TIMED_ACTIVITIES) durations[a] = range(d[a], `${p}.tuning.durations.${a}`);
  const weights = {} as Record<AutoActivity, number>;
  for (const a of AUTO_ACTIVITIES) weights[a] = num(w, a, `${p}.tuning.weights`, 0);
  return {
    creatureId: str(o, 'creatureId', p),
    x: num(o, 'x', p),
    y: num(o, 'y', p),
    speed: num(o, 'speed', p, 0),
    walkFps: num(o, 'walkFps', p, 1),
    foodItemId: str(o, 'foodItemId', p),
    followDistance: num(o, 'followDistance', p, 0),
    tuning: { durations, weights },
  };
}

/**
 * The first placed furniture offering `kind`, with the pet's spot (and hop-on
 * approach point) in room pixels. Null if the room has none — e.g. no sofa yet.
 */
export function findUseSpot(room: RoomDef, kind: UseKind): UseSpot | null {
  const item = room.furniture.find((f) => f.use?.kind === kind);
  if (!item || !item.use) return null;
  const u = item.use;
  return {
    item,
    spot: { x: item.x + u.dx, y: item.y + u.dy },
    approach: u.approachDy === undefined ? null : { x: item.x + u.dx, y: item.y + u.approachDy },
  };
}

/** Rectangles (top-left based) of the solid furniture, for wander-target picking. */
export function solidRects(room: RoomDef): { x: number; y: number; w: number; h: number }[] {
  return room.furniture.filter((f) => f.solid).map((f) => ({ x: f.x - f.w / 2, y: f.y - f.h / 2, w: f.w, h: f.h }));
}

function contains(outer: Rect, inner: Rect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Grid of `gridSize` cells: true where the whole cell lies inside a walkable rect. */
function walkGrid(room: RoomDef): boolean[][] {
  const g = room.gridSize;
  const out: boolean[][] = [];
  for (let y = 0; y < room.height / g; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < room.width / g; x++) {
      const cell = { x: x * g, y: y * g, w: g, h: g };
      row.push(room.walkable.some((r) => contains(r, cell)));
    }
    out.push(row);
  }
  return out;
}

/**
 * Where the pet may wander: walkable cells (gridSize each) that are not part
 * of an exit, so the pet never strolls out of the door on its own.
 */
export function buildFloorGrid(room: RoomDef): boolean[][] {
  const g = room.gridSize;
  return walkGrid(room).map((row, y) => row.map((ok, x) => ok && !room.exits.some((e) => overlaps(e.rect, { x: x * g, y: y * g, w: g, h: g }))));
}

/**
 * The walls as few rectangles: each run of non-walkable cells in a grid row
 * becomes one rect. The scene turns them into static physics bodies.
 */
export function wallRects(room: RoomDef): Rect[] {
  const g = room.gridSize;
  const out: Rect[] = [];
  walkGrid(room).forEach((row, y) => {
    let start = -1;
    row.forEach((ok, x) => {
      if (!ok && start < 0) start = x;
      if ((ok || x === row.length - 1) && start >= 0) {
        const end = ok ? x : x + 1;
        out.push({ x: start * g, y: y * g, w: (end - start) * g, h: g });
        start = -1;
      }
    });
  });
  return out;
}

/** The exit whose doorway contains the point, or null. */
export function exitAt(room: RoomDef, p: { x: number; y: number }): ExitDef | null {
  return room.exits.find((e) => p.x >= e.rect.x && p.x < e.rect.x + e.rect.w && p.y >= e.rect.y && p.y < e.rect.y + e.rect.h) ?? null;
}
