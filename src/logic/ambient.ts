/** A point in town pixels. */
export interface Pt {
  x: number;
  y: number;
}

/** Inclusive millisecond range [min, max]. */
export type MsRange = [number, number];

/** A random source returning [0, 1), injected so tests are deterministic. */
export type Rng = () => number;

/** Where a strolling NPC is on its route. */
export interface StrollState {
  pos: Pt;
  /** Index of the route point being walked to. */
  target: number;
  /** Time left standing still at the last point reached (ms); 0 while walking. */
  waitMs: number;
}

/** One frame of an NPC stroll: where it is now and how it moved (for the walk/idle animation). */
export interface StrollStep {
  state: StrollState;
  /** Movement this frame in px; zero while waiting. */
  dx: number;
  dy: number;
}

function between(r: MsRange, rng: Rng): number {
  return r[0] + (r[1] - r[0]) * rng();
}

/**
 * Advances an NPC along a looping route at `speed` px/s. On reaching a point
 * it stands for a random pause from `pauseMs`, then heads for the next one.
 * Leftover movement after arriving is dropped (it stops on the point).
 */
export function strollStep(s: StrollState, route: Pt[], speed: number, pauseMs: MsRange, dtMs: number, rng: Rng): StrollStep {
  if (route.length === 0) return { state: s, dx: 0, dy: 0 };
  if (s.waitMs > 0) {
    return { state: { ...s, waitMs: Math.max(0, s.waitMs - dtMs) }, dx: 0, dy: 0 };
  }
  const goal = route[s.target % route.length];
  const gx = goal.x - s.pos.x;
  const gy = goal.y - s.pos.y;
  const dist = Math.hypot(gx, gy);
  const step = (speed * dtMs) / 1000;
  if (dist <= step) {
    return {
      state: { pos: { x: goal.x, y: goal.y }, target: (s.target + 1) % route.length, waitMs: between(pauseMs, rng) },
      dx: gx,
      dy: gy,
    };
  }
  const dx = (gx / dist) * step;
  const dy = (gy / dist) * step;
  return { state: { ...s, pos: { x: s.pos.x + dx, y: s.pos.y + dy } }, dx, dy };
}

/** A bird crossing the sky: start and end just off the visible area, and how long it takes. */
export interface BirdFlight {
  from: Pt;
  to: Pt;
  durationMs: number;
}

/**
 * Plans one bird crossing a `width` x `height` area, entering at a random
 * height on one side and leaving on the other with a slight drift, at a speed
 * from `speed` (px/s). `margin` keeps it off-screen at both ends.
 */
export function planBird(width: number, height: number, speed: [number, number], margin: number, rng: Rng): BirdFlight {
  const leftToRight = rng() < 0.5;
  const y0 = height * (0.1 + 0.8 * rng());
  const y1 = Math.min(height, Math.max(0, y0 + (rng() - 0.5) * height * 0.4));
  const from = { x: leftToRight ? -margin : width + margin, y: y0 };
  const to = { x: leftToRight ? width + margin : -margin, y: y1 };
  const v = speed[0] + (speed[1] - speed[0]) * rng();
  return { from, to, durationMs: (Math.hypot(to.x - from.x, to.y - from.y) / v) * 1000 };
}

/** Next wait (ms) before something recurring happens again. */
export function nextDelay(range: MsRange, rng: Rng): number {
  return between(range, rng);
}
