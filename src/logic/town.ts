import type { NpcPersona } from './npcMind';

/** Terrain letters used in the town corner grid. */
export type Terrain = 'g' | 'c' | 'w';
const TERRAINS: Terrain[] = ['g', 'c', 'w'];

/** A rectangle of terrain painted onto the corner grid (corner coordinates, inclusive start, exclusive end). */
export interface TerrainRect {
  t: Terrain;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One Wang tileset: which terrain is its "upper" (bit set) and the sheet frame for each Wang index. */
export interface TownTileset {
  key: string;
  /** Sheet frame for Wang index NW*8 + NE*4 + SW*2 + SE*1 (bit set = upper terrain). */
  wangToFrame: number[];
}

/** Solid footprint size, centred on x and ending at the foot line y. */
export interface Footprint {
  w: number;
  h: number;
}

/** A building on the town map; (x, y) is the middle of its bottom edge (the foot line). */
export interface Building {
  id: string;
  sprite: string;
  x: number;
  y: number;
  solid: Footprint;
  /** Door x offset from the building's x; the door sits on the foot line. */
  doorDx: number;
  /**
   * Where the door's opening is drawn when someone goes in (px): its size and
   * how far its bottom sits above the foot line. Null = no opening drawn, the
   * walker just slips behind the facade.
   */
  door: { w: number; h: number; dy: number } | null;
}

/** A looping animation shown instead of a prop's still sprite: frames `<key>_01`..`<key>_NN`. */
export interface PropAnim {
  key: string;
  frames: number;
  fps: number;
}

/** A soft flickering light, `dy` px above the foot line (street lamps). */
export interface Glow {
  dy: number;
  r: number;
}

/** A decoration; (x, y) is the middle of its bottom edge. */
export interface Prop {
  sprite: string;
  x: number;
  y: number;
  solid: Footprint | null;
  anim?: PropAnim;
  glow?: Glow;
  /** Lies on the ground (a pier, a rug of planks): drawn under everything that stands. */
  flat?: boolean;
  /** Floats: bobs up and down this many px (boats). */
  bob?: number;
  /** A soft ground shadow under it (w x h ellipse centred dy px below the foot line), so it sits on the ground. */
  shadow?: { w: number; h: number; dy: number };
}

/** A townsperson with a home, favourite places and a temper (see npcMind.ts). */
export interface NpcDef extends NpcPersona {
  /** Key in sprites.json. */
  art: string;
  /** Walking speed, px/s. */
  speed: number;
}

/** A flock that now and then flies in, lands in an area (the plaza) and later leaves. */
export interface BirdsDef {
  /** Delay before the first flock (ms). */
  firstMs: number;
  /** Wait between flocks (ms). */
  everyMs: [number, number];
  /** Birds per flock. */
  flock: [number, number];
  /** How long a flock stays on the ground (ms). */
  stayMs: [number, number];
  /** Where they land. */
  landing: Box;
  /** Flight speed, px/s. */
  speed: [number, number];
  fps: number;
  /** A moving player closer than this (px) scares a bird away. */
  scareRadius: number;
}

/** A validated walkable town. */
export interface TownDef {
  tileSize: number;
  /** Camera follow lerp, 0-1. 1 = locked to the player; below 1 smooths but makes
   *  the rounded sprite wobble 1-2px against the camera (worst on diagonals). */
  cameraLerp: number;
  cols: number;
  rows: number;
  /** Corner grid, rows+1 strings of cols+1 terrain letters. */
  corners: string[];
  /** Cobblestone over grass (lower = cobble, upper = grass). */
  ground: TownTileset;
  /** Water under grass (lower = water, upper = grass), drawn only where water touches a tile. */
  water: TownTileset;
  buildings: Building[];
  props: Prop[];
  /** Named spots that are not buildings (park, harbour) for fast travel. */
  spots: Record<string, { x: number; y: number }>;
  /** Where a new visit starts when no door is given. */
  spawn: { x: number; y: number };
  /** Chimney tops that puff smoke. */
  smoke: { x: number; y: number }[];
  birds: BirdsDef | null;
  npcs: NpcDef[];
  /** Little bubbles NPCs may show while pausing. */
  npcEmotes: string[];
  /** Piers and boardwalks over water: water tiles fully inside one can be walked on. */
  walkways: Box[];
  /** Away from town (a biome reached by ferry): where to stand to sail back. Null in town. */
  ferryBack: Box | null;
}

/** Axis-aligned rectangle in town pixels. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Obj = Record<string, unknown>;

function fail(path: string, msg: string): never {
  throw new Error(`Invalid town at ${path}: ${msg}`);
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

function terrain(v: unknown, path: string): Terrain {
  if (!TERRAINS.includes(v as Terrain)) fail(path, `expected one of ${TERRAINS.join(', ')}`);
  return v as Terrain;
}

function tileset(v: unknown, path: string): TownTileset {
  const o = obj(v, path);
  const w = o.wangToFrame;
  if (!Array.isArray(w) || w.length !== 16 || !w.every((n) => Number.isInteger(n) && n >= 0)) fail(`${path}.wangToFrame`, 'expected 16 non-negative integers');
  return { key: str(o, 'key', path), wangToFrame: w as number[] };
}

function footprint(v: unknown, path: string): Footprint {
  const o = obj(v, path);
  return { w: num(o, 'w', path, 1), h: num(o, 'h', path, 1) };
}

/**
 * Paints the corner grid: everything starts as `fill`, then each rect in order
 * overwrites its corners. Corner grids are one larger than the tile grid.
 */
export function paintCorners(cols: number, rows: number, fill: Terrain, rects: TerrainRect[]): string[] {
  const grid: Terrain[][] = Array.from({ length: rows + 1 }, () => Array<Terrain>(cols + 1).fill(fill));
  for (const r of rects) {
    for (let y = Math.max(0, r.y); y < Math.min(rows + 1, r.y + r.h); y++) {
      for (let x = Math.max(0, r.x); x < Math.min(cols + 1, r.x + r.w); x++) grid[y][x] = r.t;
    }
  }
  return grid.map((row) => row.join(''));
}

/** The four corner letters of tile (x, y): NW, NE, SW, SE. */
function cornersOf(corners: string[], x: number, y: number): string[] {
  return [corners[y][x], corners[y][x + 1], corners[y + 1][x], corners[y + 1][x + 1]];
}

/**
 * Validates raw town JSON (src/data/town.json). Rejects any tile where
 * cobble and water meet, since no tileset joins those two.
 */
export function parseTown(raw: unknown): TownDef {
  const o = obj(raw, 'town');
  const tileSize = num(o, 'tileSize', 'town', 1);
  const cols = num(o, 'cols', 'town', 1);
  const rows = num(o, 'rows', 'town', 1);
  const to = obj(o.terrain, 'town.terrain');
  if (!Array.isArray(to.rects)) fail('town.terrain.rects', 'expected array');
  const rects = (to.rects as unknown[]).map((r, i): TerrainRect => {
    const p = `town.terrain.rects[${i}]`;
    const ro = obj(r, p);
    return { t: terrain(ro.t, `${p}.t`), x: num(ro, 'x', p), y: num(ro, 'y', p), w: num(ro, 'w', p, 1), h: num(ro, 'h', p, 1) };
  });
  const corners = paintCorners(cols, rows, terrain(to.fill, 'town.terrain.fill'), rects);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const c = cornersOf(corners, x, y);
      if (c.includes('c') && c.includes('w')) fail(`town.terrain`, `cobble meets water at tile (${x}, ${y}); keep a grass tile between them`);
    }
  }
  const width = cols * tileSize;
  const height = rows * tileSize;
  const inside = (x: number, y: number, path: string) => {
    if (x < 0 || y < 0 || x > width || y > height) fail(path, 'must lie inside the town');
  };
  if (!Array.isArray(o.buildings)) fail('town.buildings', 'expected array');
  const seen = new Set<string>();
  const buildings = (o.buildings as unknown[]).map((b, i): Building => {
    const p = `town.buildings[${i}]`;
    const bo = obj(b, p);
    const id = str(bo, 'id', p);
    if (seen.has(id)) fail(p, `duplicate id "${id}"`);
    seen.add(id);
    let door: Building['door'] = null;
    if (bo.door !== undefined) {
      const d = obj(bo.door, `${p}.door`);
      door = { w: num(d, 'w', `${p}.door`, 1), h: num(d, 'h', `${p}.door`, 1), dy: num(d, 'dy', `${p}.door`, 0) };
    }
    const bld = { id, sprite: str(bo, 'sprite', p), x: num(bo, 'x', p), y: num(bo, 'y', p), solid: footprint(bo.solid, `${p}.solid`), doorDx: num(bo, 'doorDx', p), door };
    inside(bld.x, bld.y, p);
    return bld;
  });
  if (!Array.isArray(o.props)) fail('town.props', 'expected array');
  const props = (o.props as unknown[]).map((pr, i): Prop => {
    const p = `town.props[${i}]`;
    const po = obj(pr, p);
    const prop: Prop = { sprite: str(po, 'sprite', p), x: num(po, 'x', p), y: num(po, 'y', p), solid: po.solid === null || po.solid === undefined ? null : footprint(po.solid, `${p}.solid`) };
    if (po.anim !== undefined) {
      const ao = obj(po.anim, `${p}.anim`);
      prop.anim = { key: str(ao, 'key', `${p}.anim`), frames: num(ao, 'frames', `${p}.anim`, 1), fps: num(ao, 'fps', `${p}.anim`, 1) };
    }
    if (po.glow !== undefined) {
      const go = obj(po.glow, `${p}.glow`);
      prop.glow = { dy: num(go, 'dy', `${p}.glow`), r: num(go, 'r', `${p}.glow`, 1) };
    }
    if (po.flat !== undefined) {
      if (typeof po.flat !== 'boolean') fail(`${p}.flat`, 'expected true or false');
      prop.flat = po.flat as boolean;
    }
    if (po.bob !== undefined) prop.bob = num(po, 'bob', p, 0);
    if (po.shadow !== undefined) {
      const so = obj(po.shadow, `${p}.shadow`);
      prop.shadow = { w: num(so, 'w', `${p}.shadow`, 1), h: num(so, 'h', `${p}.shadow`, 1), dy: typeof so.dy === 'number' ? so.dy : 0 };
    }
    inside(prop.x, prop.y, p);
    return prop;
  });
  const point = (v: unknown, path: string) => {
    const vo = obj(v, path);
    const pt = { x: num(vo, 'x', path), y: num(vo, 'y', path) };
    inside(pt.x, pt.y, path);
    return pt;
  };
  const pair = (v: unknown, path: string): [number, number] => {
    if (!Array.isArray(v) || v.length !== 2 || !v.every((n) => typeof n === 'number' && n >= 0) || v[0] > v[1]) fail(path, 'expected [min, max] with 0 <= min <= max');
    return [v[0], v[1]];
  };
  const smoke = Array.isArray(o.smoke) ? o.smoke.map((v, i) => point(v, `town.smoke[${i}]`)) : [];
  let birds: BirdsDef | null = null;
  if (o.birds !== undefined) {
    const bo = obj(o.birds, 'town.birds');
    const lo = obj(bo.landing, 'town.birds.landing');
    birds = {
      firstMs: num(bo, 'firstMs', 'town.birds', 0),
      everyMs: pair(bo.everyMs, 'town.birds.everyMs'),
      flock: pair(bo.flock, 'town.birds.flock'),
      stayMs: pair(bo.stayMs, 'town.birds.stayMs'),
      landing: { x: num(lo, 'x', 'town.birds.landing'), y: num(lo, 'y', 'town.birds.landing'), w: num(lo, 'w', 'town.birds.landing', 1), h: num(lo, 'h', 'town.birds.landing', 1) },
      speed: pair(bo.speed, 'town.birds.speed'),
      fps: num(bo, 'fps', 'town.birds', 1),
      scareRadius: num(bo, 'scareRadius', 'town.birds', 0),
    };
    if (birds.flock[0] < 1) fail('town.birds.flock', 'expected at least one bird');
  }
  const ids = new Set(buildings.map((b) => b.id));
  const building = (v: unknown, path: string) => {
    if (typeof v !== 'string' || !ids.has(v)) fail(path, `expected a building id (${[...ids].join(', ')})`);
    return v;
  };
  const npcs = (Array.isArray(o.npcs) ? o.npcs : []).map((n, i): NpcDef => {
    const p = `town.npcs[${i}]`;
    const no = obj(n, p);
    const wo = obj(no.weights, `${p}.weights`);
    if (!Array.isArray(no.favorites) || no.favorites.length === 0) fail(`${p}.favorites`, 'expected at least one building');
    return {
      art: str(no, 'art', p),
      speed: num(no, 'speed', p, 1),
      home: building(no.home, `${p}.home`),
      favorites: (no.favorites as unknown[]).map((f, j) => building(f, `${p}.favorites[${j}]`)),
      weights: { visit: num(wo, 'visit', `${p}.weights`, 0), home: num(wo, 'home', `${p}.weights`, 0), stroll: num(wo, 'stroll', `${p}.weights`, 0), idle: num(wo, 'idle', `${p}.weights`, 0) },
      insideMs: pair(no.insideMs, `${p}.insideMs`),
      idleMs: pair(no.idleMs, `${p}.idleMs`),
      temper: num(no, 'temper', p, 1),
    };
  });
  const npcEmotes = Array.isArray(o.npcEmotes) ? o.npcEmotes.filter((e): e is string => typeof e === 'string' && e !== '') : [];
  const so = obj(o.spots ?? {}, 'town.spots');
  const spots: Record<string, { x: number; y: number }> = {};
  for (const [k, v] of Object.entries(so)) {
    const vo = obj(v, `town.spots.${k}`);
    spots[k] = { x: num(vo, 'x', `town.spots.${k}`), y: num(vo, 'y', `town.spots.${k}`) };
    inside(spots[k].x, spots[k].y, `town.spots.${k}`);
  }
  const sp = obj(o.spawn, 'town.spawn');
  const spawn = { x: num(sp, 'x', 'town.spawn'), y: num(sp, 'y', 'town.spawn') };
  inside(spawn.x, spawn.y, 'town.spawn');
  const walkways = (Array.isArray(o.walkways) ? o.walkways : []).map((v, i): Box => {
    const p = `town.walkways[${i}]`;
    const wo = obj(v, p);
    const box = { x: num(wo, 'x', p), y: num(wo, 'y', p), w: num(wo, 'w', p, 1), h: num(wo, 'h', p, 1) };
    inside(box.x, box.y, p);
    return box;
  });
  let ferryBack: Box | null = null;
  if (o.ferryBack !== undefined) {
    const fo = obj(o.ferryBack, 'town.ferryBack');
    ferryBack = { x: num(fo, 'x', 'town.ferryBack'), y: num(fo, 'y', 'town.ferryBack'), w: num(fo, 'w', 'town.ferryBack', 1), h: num(fo, 'h', 'town.ferryBack', 1) };
  }
  const cameraLerp = o.cameraLerp === undefined ? 1 : num(o, 'cameraLerp', 'town', 0);
  if (cameraLerp <= 0 || cameraLerp > 1) throw new Error('town.cameraLerp must be in (0, 1]');
  return { tileSize, cameraLerp, cols, rows, corners, ground: tileset(o.ground, 'town.ground'), water: tileset(o.water, 'town.water'), buildings, props, spots, spawn, smoke, birds, npcs, npcEmotes, walkways, ferryBack };
}

function wang(c: string[], upper: (t: string) => boolean): number {
  return (upper(c[0]) ? 8 : 0) + (upper(c[1]) ? 4 : 0) + (upper(c[2]) ? 2 : 0) + (upper(c[3]) ? 1 : 0);
}

/**
 * Sheet frames for the two tile layers. Ground: cobble is lower, grass (and
 * water, which the water layer covers) is upper. Water: drawn only on tiles
 * touching water, -1 elsewhere; water is lower, grass upper.
 */
export function townLayers(town: TownDef): { ground: number[][]; water: number[][] } {
  const ground: number[][] = [];
  const water: number[][] = [];
  for (let y = 0; y < town.rows; y++) {
    const g: number[] = [];
    const w: number[] = [];
    for (let x = 0; x < town.cols; x++) {
      const c = cornersOf(town.corners, x, y);
      g.push(town.ground.wangToFrame[wang(c, (t) => t !== 'c')]);
      w.push(c.includes('w') ? town.water.wangToFrame[wang(c, (t) => t !== 'w')] : -1);
    }
    ground.push(g);
    water.push(w);
  }
  return { ground, water };
}

/** Footprint rectangle of something standing with its foot line at (x, y). */
export function footBox(x: number, y: number, f: Footprint): Box {
  return { x: x - f.w / 2, y: y - f.h, w: f.w, h: f.h };
}

/**
 * Everything solid, as rectangles: tiles touching water (merged per row run),
 * building footprints and prop footprints.
 */
export function townSolids(town: TownDef): Box[] {
  const s = town.tileSize;
  const out: Box[] = [];
  for (let y = 0; y < town.rows; y++) {
    let start = -1;
    for (let x = 0; x <= town.cols; x++) {
      const onWalkway = town.walkways.some((w) => x * s >= w.x && (x + 1) * s <= w.x + w.w && y * s >= w.y && (y + 1) * s <= w.y + w.h);
      const wet = x < town.cols && cornersOf(town.corners, x, y).includes('w') && !onWalkway;
      if (wet && start < 0) start = x;
      if (!wet && start >= 0) {
        out.push({ x: start * s, y: y * s, w: (x - start) * s, h: s });
        start = -1;
      }
    }
  }
  for (const b of town.buildings) out.push(footBox(b.x, b.y, b.solid));
  for (const p of town.props) if (p.solid) out.push(footBox(p.x, p.y, p.solid));
  return out;
}

/** Door trigger depth (px) below a building's foot line. */
export const DOOR_DEPTH = 14;
/** Door trigger width (px). */
export const DOOR_WIDTH = 22;

/** The strip just below a building's door where walking up enters it. */
export function doorBox(b: Building): Box {
  return { x: b.x + b.doorDx - DOOR_WIDTH / 2, y: b.y, w: DOOR_WIDTH, h: DOOR_DEPTH };
}

/** The building whose door strip contains the point (the player's feet), or null. */
export function doorAt(town: TownDef, p: { x: number; y: number }): Building | null {
  return (
    town.buildings.find((b) => {
      const d = doorBox(b);
      return p.x >= d.x && p.x < d.x + d.w && p.y >= d.y && p.y < d.y + d.h;
    }) ?? null
  );
}

/**
 * Whether a full (single-terrain) tile at (x, y) is drawn mirrored, to break
 * up the visible repeat of one grass or path tile. A fixed hash, so the town
 * looks the same on every visit.
 */
export function tileFlip(x: number, y: number): { flipX: boolean; flipY: boolean } {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return { flipX: (h & 1) === 1, flipY: (h & 2) === 2 };
}

/** Where to stand when arriving at a place: just below its door, or at a named spot. */
export function arrivalPoint(town: TownDef, place: string): { x: number; y: number } | null {
  const b = town.buildings.find((x) => x.id === place);
  if (b) return { x: b.x + b.doorDx, y: b.y + DOOR_DEPTH + 14 };
  return town.spots[place] ?? null;
}
