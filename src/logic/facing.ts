/** Facing directions used in asset names: <name>_<action>_<dir>_<frame>.png */
export type Dir = 'down' | 'up' | 'right' | 'left';

/**
 * Facing for a movement vector, with only four drawn directions.
 *
 * Diagonals keep the current facing when it is one of the two directions being
 * pressed (walking down, then adding left, keeps facing down). Without that the
 * sprite snaps sideways the moment a second key is touched and reads as
 * sliding. A fresh diagonal (current facing is neither axis) picks the
 * horizontal facing so side-walking reads clearly.
 */
export function facingFor(vx: number, vy: number, current: Dir): Dir {
  if (vx === 0 && vy === 0) return current;
  const h: Dir | null = vx > 0 ? 'right' : vx < 0 ? 'left' : null;
  const v: Dir | null = vy > 0 ? 'down' : vy < 0 ? 'up' : null;
  if (h && !v) return h;
  if (v && !h) return v;
  const ax = Math.abs(vx);
  const ay = Math.abs(vy);
  // A clearly dominant axis wins (NPC paths are rarely exact 45°).
  if (ax > ay * 2) return h!;
  if (ay > ax * 2) return v!;
  if (current === h || current === v) return current;
  return h!;
}
