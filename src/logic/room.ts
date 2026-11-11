import type { AutoActivity, MsRange, PetActivity, PetTuning } from './petBrain';

/** One piece of furniture placed in a room; x/y are the sprite centre in pixels. */
export interface FurnitureDef {
  key: string;
  x: number;
  y: number;
  solid: boolean;
}

/** Player spawn and movement tuning for a room. */
export interface PlayerDef {
  /** Asset folder/prefix of the player character, e.g. "player". */
  character: string;
  x: number;
  y: number;
  speed: number;
  walkFps: number;
  /** Distance in px at which the player can interact with the pet. */
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
  eatSpot: { x: number; y: number };
  sleepSpot: { x: number; y: number };
  foodItemId: string;
  tuning: PetTuning;
}

/** A validated room layout, ready for a scene to draw. */
export interface RoomDef {
  tileSize: number;
  tileset: string;
  /** Sheet frame for each Wang index 0..15 (NW=8, NE=4, SW=2, SE=1; bit set = wall). */
  wangToFrame: number[];
  /** Corner grid: '#' wall, '.' floor. One row/column larger than the tile grid. */
  corners: string[];
  furniture: FurnitureDef[];
  player: PlayerDef;
  pet: PetDef;
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

/**
 * Validates raw room JSON (src/data/home.json) and returns a typed RoomDef.
 * Throws an Error naming the bad field.
 */
export function parseRoom(raw: unknown): RoomDef {
  const o = obj(raw, 'room');
  const w = o.wangToFrame;
  if (!Array.isArray(w) || w.length !== 16 || !w.every((n) => Number.isInteger(n) && n >= 0)) {
    fail('room.wangToFrame', 'expected 16 non-negative integers');
  }
  const corners = o.corners;
  if (!Array.isArray(corners) || corners.length < 2) fail('room.corners', 'expected at least 2 rows');
  const width = (corners[0] as string).length;
  corners.forEach((r, i) => {
    if (typeof r !== 'string' || r.length !== width || !/^[#.]+$/.test(r)) {
      fail(`room.corners[${i}]`, `expected ${width} characters of '#' or '.'`);
    }
  });
  if (width < 2) fail('room.corners', 'expected at least 2 columns');
  if (!Array.isArray(o.furniture)) fail('room.furniture', 'expected array');
  const furniture = (o.furniture as unknown[]).map((e, i) => {
    const p = `room.furniture[${i}]`;
    const f = obj(e, p);
    if (typeof f.solid !== 'boolean') fail(`${p}.solid`, 'expected boolean');
    return { key: str(f, 'key', p), x: num(f, 'x', p), y: num(f, 'y', p), solid: f.solid };
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
  const pet = parsePet(o.pet);
  return {
    tileSize: num(o, 'tileSize', 'room', 1),
    tileset: str(o, 'tileset', 'room'),
    wangToFrame: w as number[],
    corners: corners as string[],
    furniture,
    player,
    pet,
  };
}

function point(v: unknown, path: string): { x: number; y: number } {
  const o = obj(v, path);
  return { x: num(o, 'x', path), y: num(o, 'y', path) };
}

function range(v: unknown, path: string): MsRange {
  if (!Array.isArray(v) || v.length !== 2 || !v.every((n) => typeof n === 'number' && n >= 0) || v[0] > v[1]) {
    fail(path, 'expected [min, max] with 0 <= min <= max');
  }
  return [v[0], v[1]];
}

const ACTIVITIES: PetActivity[] = ['idle', 'wander', 'eat', 'sleep', 'petted'];
const AUTO: AutoActivity[] = ['idle', 'wander', 'eat', 'sleep'];

function parsePet(raw: unknown): PetDef {
  const p = 'room.pet';
  const o = obj(raw, p);
  const t = obj(o.tuning, `${p}.tuning`);
  const d = obj(t.durations, `${p}.tuning.durations`);
  const w = obj(t.weights, `${p}.tuning.weights`);
  const durations = {} as Record<PetActivity, MsRange>;
  for (const a of ACTIVITIES) durations[a] = range(d[a], `${p}.tuning.durations.${a}`);
  const weights = {} as Record<AutoActivity, number>;
  for (const a of AUTO) weights[a] = num(w, a, `${p}.tuning.weights`, 0);
  return {
    creatureId: str(o, 'creatureId', p),
    x: num(o, 'x', p),
    y: num(o, 'y', p),
    speed: num(o, 'speed', p, 0),
    walkFps: num(o, 'walkFps', p, 1),
    eatSpot: point(o.eatSpot, `${p}.eatSpot`),
    sleepSpot: point(o.sleepSpot, `${p}.sleepSpot`),
    foodItemId: str(o, 'foodItemId', p),
    tuning: { durations, weights },
  };
}

/** Walkable grid: true where a tile is the all-floor frame. */
export function buildFloorGrid(room: RoomDef): boolean[][] {
  const floor = floorFrame(room);
  return buildTileFrames(room).map((row) => row.map((f) => f === floor));
}

/**
 * Wang index of the tile whose top-left corner is (x, y) in the corner grid:
 * NW*8 + NE*4 + SW*2 + SE*1, where a wall corner counts 1.
 */
export function wangIndex(corners: string[], x: number, y: number): number {
  const wall = (cx: number, cy: number): number => (corners[cy][cx] === '#' ? 1 : 0);
  return wall(x, y) * 8 + wall(x + 1, y) * 4 + wall(x, y + 1) * 2 + wall(x + 1, y + 1);
}

/** Tile grid (rows of sheet frames) for a room, one smaller than its corner grid each way. */
export function buildTileFrames(room: RoomDef): number[][] {
  const rows = room.corners.length - 1;
  const cols = room.corners[0].length - 1;
  const out: number[][] = [];
  for (let y = 0; y < rows; y++) {
    const row: number[] = [];
    for (let x = 0; x < cols; x++) row.push(room.wangToFrame[wangIndex(room.corners, x, y)]);
    out.push(row);
  }
  return out;
}

/** Sheet frame of the all-floor tile; every other frame touches a wall and blocks movement. */
export function floorFrame(room: RoomDef): number {
  return room.wangToFrame[0];
}
