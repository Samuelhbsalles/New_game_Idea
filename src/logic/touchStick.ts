/** A direction the on-screen stick can press (same as the arrow keys). */
export type StickDir = 'up' | 'down' | 'left' | 'right';

/** Each axis only counts when it is at least this share of the push (keeps near-straight pushes straight). */
const AXIS_SHARE = 0.4;

/**
 * Which arrow directions a touch stick presses for a finger offset (dx, dy)
 * from the stick's centre (screen pixels, y down). Nothing inside the dead
 * zone (a fraction of `radius`); diagonals press two directions.
 */
export function stickDirs(dx: number, dy: number, radius: number, deadZone: number): StickDir[] {
  const len = Math.hypot(dx, dy);
  if (len < radius * deadZone) return [];
  const ux = dx / len;
  const uy = dy / len;
  const out: StickDir[] = [];
  if (Math.abs(ux) >= AXIS_SHARE) out.push(ux > 0 ? 'right' : 'left');
  if (Math.abs(uy) >= AXIS_SHARE) out.push(uy > 0 ? 'down' : 'up');
  return out;
}
