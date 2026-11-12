/** A point in town pixels. */
export interface Pt {
  x: number;
  y: number;
}

/** A random source returning [0, 1), injected so tests are deterministic. */
export type Rng = () => number;

// ---- walkable grid and paths ----------------------------------------------------

/** A coarse walkability grid over the town: true = free. */
export interface NavGrid {
  cell: number;
  cols: number;
  rows: number;
  free: boolean[][];
}

/**
 * Rasterises solid rectangles onto a grid of `cell`-px squares. A cell is
 * blocked when any solid overlaps it after growing the solid by `pad` px
 * (the walker's half-width), so paths keep a body's width from walls.
 */
export function buildNavGrid(width: number, height: number, cell: number, solids: { x: number; y: number; w: number; h: number }[], pad: number): NavGrid {
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const free = Array.from({ length: rows }, () => Array<boolean>(cols).fill(true));
  for (const s of solids) {
    const x0 = Math.max(0, Math.floor((s.x - pad) / cell));
    const y0 = Math.max(0, Math.floor((s.y - pad) / cell));
    const x1 = Math.min(cols - 1, Math.floor((s.x + s.w + pad - 1) / cell));
    const y1 = Math.min(rows - 1, Math.floor((s.y + s.h + pad - 1) / cell));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) free[y][x] = false;
  }
  return { cell, cols, rows, free };
}

const cellOf = (g: NavGrid, p: Pt) => ({ cx: Math.min(g.cols - 1, Math.max(0, Math.floor(p.x / g.cell))), cy: Math.min(g.rows - 1, Math.max(0, Math.floor(p.y / g.cell))) });
const centre = (g: NavGrid, cx: number, cy: number): Pt => ({ x: cx * g.cell + g.cell / 2, y: cy * g.cell + g.cell / 2 });

/** The free cell nearest to `p` (searching outwards), or null if the grid is all blocked. */
function nearestFree(g: NavGrid, p: Pt): { cx: number; cy: number } | null {
  const { cx, cy } = cellOf(g, p);
  for (let r = 0; r < Math.max(g.cols, g.rows); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && y >= 0 && x < g.cols && y < g.rows && g.free[y][x]) return { cx: x, cy: y };
      }
    }
  }
  return null;
}

/**
 * A* over the grid (4-way), from the free cell nearest `from` to the free
 * cell nearest `to`. Returns waypoints (cell centres, corners only — straight
 * runs collapse), ending exactly at `to`; empty when unreachable.
 */
export function findPath(g: NavGrid, from: Pt, to: Pt): Pt[] {
  const s = nearestFree(g, from);
  const t = nearestFree(g, to);
  if (!s || !t) return [];
  const key = (x: number, y: number) => y * g.cols + x;
  const h = (x: number, y: number) => Math.abs(x - t.cx) + Math.abs(y - t.cy);
  const gScore = new Map<number, number>([[key(s.cx, s.cy), 0]]);
  const came = new Map<number, number>();
  const open: { x: number; y: number; f: number }[] = [{ x: s.cx, y: s.cy, f: h(s.cx, s.cy) }];
  const closed = new Set<number>();
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    const ck = key(cur.x, cur.y);
    if (closed.has(ck)) continue;
    closed.add(ck);
    if (cur.x === t.cx && cur.y === t.cy) {
      const cells: { x: number; y: number }[] = [];
      let k: number | undefined = ck;
      while (k !== undefined) {
        cells.push({ x: k % g.cols, y: Math.floor(k / g.cols) });
        k = came.get(k);
      }
      cells.reverse();
      // Keep only the cells where the direction changes.
      const pts: Pt[] = [];
      for (let i = 1; i < cells.length; i++) {
        const prev = cells[i - 1];
        const next = cells[i + 1];
        const turns = !next || next.x - cells[i].x !== cells[i].x - prev.x || next.y - cells[i].y !== cells[i].y - prev.y;
        if (turns) pts.push(centre(g, cells[i].x, cells[i].y));
      }
      pts.push({ ...to });
      return pts;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= g.cols || ny >= g.rows || !g.free[ny][nx]) continue;
      const nk = key(nx, ny);
      const ng = (gScore.get(ck) ?? 0) + 1;
      if (ng < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, ng);
        came.set(nk, ck);
        open.push({ x: nx, y: ny, f: ng + h(nx, ny) });
      }
    }
  }
  return [];
}

// ---- decisions and mood -----------------------------------------------------------

/** What an NPC is up to. */
export type NpcActivity = 'walking' | 'inside' | 'idle' | 'chatting' | 'angry';

/** One NPC's personality and favourite places (town.json). */
export interface NpcPersona {
  /** Building it lives in. */
  home: string;
  /** Buildings it likes to visit. */
  favorites: string[];
  /** Relative weights of the next choice. */
  weights: { visit: number; home: number; stroll: number; idle: number };
  /** How long it stays inside a building (ms). */
  insideMs: [number, number];
  /** How long it idles or chats (ms). */
  idleMs: [number, number];
  /** Bumps in a short time before it gets angry. */
  temper: number;
}

/** The next thing an NPC decides to do. */
export type NpcPlan = { kind: 'visit'; building: string } | { kind: 'home'; building: string } | { kind: 'stroll' } | { kind: 'idle'; ms: number };

/** Picks the next plan by weight, never visiting the building it just left. */
export function decideNext(p: NpcPersona, lastBuilding: string | null, rng: Rng): NpcPlan {
  const visits = p.favorites.filter((b) => b !== lastBuilding);
  const options: [NpcPlan['kind'], number][] = [
    ['visit', visits.length ? p.weights.visit : 0],
    ['home', lastBuilding === p.home ? 0 : p.weights.home],
    ['stroll', p.weights.stroll],
    ['idle', p.weights.idle],
  ];
  const total = options.reduce((a, [, w]) => a + w, 0);
  let r = rng() * total;
  let kind: NpcPlan['kind'] = 'stroll';
  for (const [k, w] of options) {
    if (r < w) {
      kind = k;
      break;
    }
    r -= w;
  }
  if (kind === 'visit') return { kind, building: visits[Math.min(visits.length - 1, Math.floor(rng() * visits.length))] };
  if (kind === 'home') return { kind, building: p.home };
  if (kind === 'idle') return { kind, ms: p.idleMs[0] + (p.idleMs[1] - p.idleMs[0]) * rng() };
  return { kind: 'stroll' };
}

/** How annoyed an NPC is: bumps decay over time; past its temper it gets angry. */
export interface Mood {
  annoyance: number;
}

/** Annoyance lost per second. */
export const ANNOYANCE_DECAY = 0.25;

/** One bump from the player. Returns the new mood and whether it just became angry. */
export function bump(m: Mood, temper: number): { mood: Mood; angry: boolean } {
  const before = m.annoyance;
  const annoyance = before + 1;
  return { mood: { annoyance }, angry: before < temper && annoyance >= temper };
}

/** Lets annoyance fade. */
export function calmDown(m: Mood, dtMs: number): Mood {
  return { annoyance: Math.max(0, m.annoyance - (ANNOYANCE_DECAY * dtMs) / 1000) };
}
