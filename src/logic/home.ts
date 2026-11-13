import type { FloorPlan, FurnitureItem, Rect } from './room';

/** One piece of furniture standing in the home: catalog id and centre point (room pixels). */
export interface Placement {
  item: string;
  x: number;
  y: number;
}

/** A player's furniture: what stands where, and what is packed away (catalog id -> count). */
export interface HomeLayout {
  placements: Placement[];
  stored: Record<string, number>;
}

/** Grid furniture snaps to (px), so pieces line up neatly. */
export const SNAP = 4;

/** Why a piece cannot go somewhere. */
export type PlaceReason = 'unknown' | 'outside' | 'overlap' | 'door';
export type PlaceCheck = { ok: true } | { ok: false; reason: PlaceReason };

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Draw depth for a placed piece: solid ones sort by their foot line; low ones lie on the floor, rugs lowest. */
export function pieceDepth(item: FurnitureItem, y: number): number {
  return item.solid ? y + item.h / 2 : item.flat ? -600 : -500;
}

/** Shadows sit under every piece, on the floor. */
export const SHADOW_DEPTH = -900;

/** Rounds a point to the furniture grid. */
export function snap(v: number): number {
  return Math.round(v / SNAP) * SNAP;
}

/**
 * The floor a piece occupies. A solid piece stands on its lower half (its top
 * half may rise over the wall, like a tall bookshelf); a flat or low piece
 * (rug, pet bed, bowl) lies on all of it. Matches how HomeScene builds bodies.
 */
export function footprint(item: FurnitureItem, x: number, y: number): Rect {
  return item.solid ? { x: x - item.w / 2, y, w: item.w, h: item.h / 2 } : { x: x - item.w / 2, y: y - item.h / 2, w: item.w, h: item.h };
}

/** Floor kept clear in front of each door, so the player can always get in and out. */
export function doorZones(plan: FloorPlan): Rect[] {
  return plan.exits.map((e) => {
    const top = Math.min(e.rect.y, e.arrive.y - 16);
    return { x: e.rect.x - 8, y: top, w: e.rect.w + 16, h: e.rect.y + e.rect.h - top };
  });
}

function insideFloor(plan: FloorPlan, r: Rect): boolean {
  // Every corner on walkable floor (the floor is a few big rectangles).
  const pts = [
    [r.x, r.y],
    [r.x + r.w - 0.01, r.y],
    [r.x, r.y + r.h - 0.01],
    [r.x + r.w - 0.01, r.y + r.h - 0.01],
  ];
  return pts.every(([px, py]) => plan.walkable.some((w) => px >= w.x && px < w.x + w.w && py >= w.y && py < w.y + w.h));
}

/**
 * Can `itemId` stand at (x, y) among `others`? Its footprint must lie on the
 * floor, keep clear of the doors, and not touch a solid piece's footprint
 * (low pieces may share floor with each other: a bowl on a rug is fine).
 * Flat pieces (rugs) are part of the floor: they only need to be on it, may
 * lie in front of a door, and anything may stand on them.
 */
export function checkPlacement(plan: FloorPlan, catalog: FurnitureItem[], others: Placement[], itemId: string, x: number, y: number): PlaceCheck {
  const item = catalog.find((c) => c.id === itemId);
  if (!item) return { ok: false, reason: 'unknown' };
  const fp = footprint(item, x, y);
  if (!insideFloor(plan, fp)) return { ok: false, reason: 'outside' };
  if (item.flat) return { ok: true };
  if (doorZones(plan).some((z) => overlaps(fp, z))) return { ok: false, reason: 'door' };
  for (const o of others) {
    const other = catalog.find((c) => c.id === o.item);
    if (!other || other.flat) continue;
    if (!item.solid && !other.solid) continue;
    if (overlaps(fp, footprint(other, o.x, o.y))) return { ok: false, reason: 'overlap' };
  }
  return { ok: true };
}

/** The layout with the piece at `index` lifted out (to be moved, or stored). */
export function pickUp(layout: HomeLayout, index: number): { layout: HomeLayout; held: Placement } {
  const held = layout.placements[index];
  if (!held) throw new Error(`No furniture at index ${index}`);
  return { layout: { ...layout, placements: layout.placements.filter((_, i) => i !== index) }, held };
}

/** Puts a held piece down at (x, y), snapped, if it fits; the layout is unchanged otherwise. */
export function drop(plan: FloorPlan, catalog: FurnitureItem[], layout: HomeLayout, itemId: string, x: number, y: number): { ok: true; layout: HomeLayout } | { ok: false; reason: PlaceReason } {
  const sx = snap(x);
  const sy = snap(y);
  const check = checkPlacement(plan, catalog, layout.placements, itemId, sx, sy);
  if (!check.ok) return check;
  return { ok: true, layout: { ...layout, placements: [...layout.placements, { item: itemId, x: sx, y: sy }] } };
}

/** Packs a piece away into storage. */
export function store(layout: HomeLayout, itemId: string): HomeLayout {
  return { ...layout, stored: { ...layout.stored, [itemId]: (layout.stored[itemId] ?? 0) + 1 } };
}

/** Takes one `itemId` out of storage (to be placed), or null if none is stored. */
export function unstore(layout: HomeLayout, itemId: string): HomeLayout | null {
  const n = layout.stored[itemId] ?? 0;
  if (n <= 0) return null;
  const stored = { ...layout.stored, [itemId]: n - 1 };
  if (stored[itemId] === 0) delete stored[itemId];
  return { ...layout, stored };
}

/** Index of the topmost piece whose picture covers the point, or -1. */
export function pieceAt(catalog: FurnitureItem[], layout: HomeLayout, x: number, y: number): number {
  let best = -1;
  let bestY = -Infinity;
  layout.placements.forEach((p, i) => {
    const it = catalog.find((c) => c.id === p.item);
    if (!it) return;
    const inside = x >= p.x - it.w / 2 && x < p.x + it.w / 2 && y >= p.y - it.h / 2 && y < p.y + it.h / 2;
    // The piece drawn in front (lowest on screen) wins; a rug only when nothing stands over the point.
    const rank = (it.flat ? -10_000 : 0) + p.y + it.h / 2;
    if (inside && rank > bestY) {
      best = i;
      bestY = rank;
    }
  });
  return best;
}

/** A starter home: the room's default furniture, nothing stored. */
export function defaultLayout(placements: Placement[]): HomeLayout {
  return { placements: placements.map((p) => ({ ...p })), stored: {} };
}

/**
 * Reads a layout from a save, keeping only pieces the catalog knows and
 * whole positive counts. Null when it is not a layout at all.
 */
export function parseLayout(raw: unknown, catalog: FurnitureItem[]): HomeLayout | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.placements) || typeof o.stored !== 'object' || o.stored === null) return null;
  const known = new Set(catalog.map((c) => c.id));
  const placements: Placement[] = [];
  for (const p of o.placements as unknown[]) {
    const q = p as Record<string, unknown>;
    if (typeof q?.item === 'string' && known.has(q.item) && Number.isFinite(q.x) && Number.isFinite(q.y)) placements.push({ item: q.item, x: q.x as number, y: q.y as number });
  }
  const stored: Record<string, number> = {};
  for (const [k, v] of Object.entries(o.stored as Record<string, unknown>)) if (known.has(k) && Number.isInteger(v) && (v as number) > 0) stored[k] = v as number;
  return { placements, stored };
}
