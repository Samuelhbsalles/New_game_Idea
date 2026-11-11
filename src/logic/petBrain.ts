/** What a pet is doing on its own. 'petted' is only ever started by the player. */
export type PetActivity = 'idle' | 'wander' | 'eat' | 'sleep' | 'petted';

/** The activities a pet may pick by itself, with their relative weights. */
export type AutoActivity = 'idle' | 'wander' | 'eat' | 'sleep';

/** Inclusive millisecond range. */
export type MsRange = [number, number];

/** Pet behaviour tuning, loaded from the room JSON. */
export interface PetTuning {
  durations: Record<PetActivity, MsRange>;
  weights: Record<AutoActivity, number>;
}

/** A decided activity and how long it lasts once the pet arrives (for eat/sleep) or starts. */
export interface PetPlan {
  activity: PetActivity;
  durationMs: number;
}

/** Random source returning [0, 1). Injected so tests are deterministic. */
export type Rng = () => number;

const AUTO: AutoActivity[] = ['idle', 'wander', 'eat', 'sleep'];

/** Duration inside a range, picked by one rng draw. */
export function pickDuration(range: MsRange, rng: Rng): number {
  const [min, max] = range;
  return Math.round(min + (max - min) * rng());
}

/**
 * Picks the pet's next self-chosen activity by weight. Never repeats `previous`
 * when another activity has weight, so the pet doesn't stand still twice in a row.
 * @example nextActivity(tuning, Math.random, 'idle') // { activity: 'wander', durationMs: 2400 }
 */
export function nextActivity(tuning: PetTuning, rng: Rng, previous?: PetActivity): PetPlan {
  let pool = AUTO.filter((a) => tuning.weights[a] > 0);
  const withoutPrev = pool.filter((a) => a !== previous);
  if (withoutPrev.length > 0) pool = withoutPrev;
  if (pool.length === 0) return { activity: 'idle', durationMs: pickDuration(tuning.durations.idle, rng) };
  const total = pool.reduce((s, a) => s + tuning.weights[a], 0);
  let roll = rng() * total;
  let chosen = pool[pool.length - 1];
  for (const a of pool) {
    roll -= tuning.weights[a];
    if (roll < 0) {
      chosen = a;
      break;
    }
  }
  return { activity: chosen, durationMs: pickDuration(tuning.durations[chosen], rng) };
}

/** The plan started when the player picks an action from the pet menu. */
export function playerPlan(tuning: PetTuning, activity: 'petted' | 'eat' | 'sleep', rng: Rng): PetPlan {
  return { activity, durationMs: pickDuration(tuning.durations[activity], rng) };
}

/**
 * Picks a random walkable floor point (tile centre) for wandering, avoiding
 * `blocked` rectangles (solid furniture). Returns null if no tile is free.
 * `floor[y][x]` is true for a walkable tile.
 */
export function pickWanderTarget(
  floor: boolean[][],
  tileSize: number,
  blocked: { x: number; y: number; w: number; h: number }[],
  rng: Rng,
): { x: number; y: number } | null {
  const free: { x: number; y: number }[] = [];
  floor.forEach((row, ty) =>
    row.forEach((ok, tx) => {
      if (!ok) return;
      const x = tx * tileSize + tileSize / 2;
      const y = ty * tileSize + tileSize / 2;
      const hit = blocked.some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
      if (!hit) free.push({ x, y });
    }),
  );
  if (free.length === 0) return null;
  return free[Math.min(free.length - 1, Math.floor(rng() * free.length))];
}
