/**
 * What a pet is doing. 'petted' and 'follow' are only started by the player;
 * the rest the pet may also pick by itself.
 */
export type PetActivity = 'idle' | 'wander' | 'eat' | 'sleep' | 'lounge' | 'askPet' | 'petted' | 'follow';

/** The activities a pet may pick by itself, with their relative weights. */
export type AutoActivity = 'idle' | 'wander' | 'eat' | 'sleep' | 'lounge' | 'askPet';

/** Activities with a duration range in the tuning ('follow' lasts until stopped). */
export type TimedActivity = Exclude<PetActivity, 'follow'>;

export const AUTO_ACTIVITIES: AutoActivity[] = ['idle', 'wander', 'eat', 'sleep', 'lounge', 'askPet'];
export const TIMED_ACTIVITIES: TimedActivity[] = ['idle', 'wander', 'eat', 'sleep', 'lounge', 'askPet', 'petted'];

/** Inclusive millisecond range. */
export type MsRange = [number, number];

/** Pet behaviour tuning, loaded from the room JSON. */
export interface PetTuning {
  durations: Record<TimedActivity, MsRange>;
  weights: Record<AutoActivity, number>;
}

/** A decided activity and how long it lasts once started (Infinity for 'follow'). */
export interface PetPlan {
  activity: PetActivity;
  durationMs: number;
}

/** Random source returning [0, 1). Injected so tests are deterministic. */
export type Rng = () => number;

/** Duration inside a range, picked by one rng draw. */
export function pickDuration(range: MsRange, rng: Rng): number {
  const [min, max] = range;
  return Math.round(min + (max - min) * rng());
}

/**
 * Picks the pet's next self-chosen activity by weight.
 * - Skips activities `isAllowed` rejects (e.g. 'eat' with an empty bowl, 'lounge' with no sofa).
 * - Never repeats `previous` when another activity is possible, so it keeps changing what it does.
 * @example nextActivity(tuning, Math.random, 'idle', (a) => a !== 'eat')
 */
export function nextActivity(
  tuning: PetTuning,
  rng: Rng,
  previous?: PetActivity,
  isAllowed: (a: AutoActivity) => boolean = () => true,
): PetPlan {
  let pool = AUTO_ACTIVITIES.filter((a) => tuning.weights[a] > 0 && isAllowed(a));
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
export function playerPlan(tuning: PetTuning, activity: 'petted' | 'eat' | 'sleep' | 'follow', rng: Rng): PetPlan {
  if (activity === 'follow') return { activity, durationMs: Infinity };
  return { activity, durationMs: pickDuration(tuning.durations[activity], rng) };
}

/**
 * Where a following pet should walk: toward the leader, stopping `distance` px
 * short. Returns null when already close enough (the pet should stand still).
 */
export function followTarget(
  pet: { x: number; y: number },
  leader: { x: number; y: number },
  distance: number,
): { x: number; y: number } | null {
  const dx = leader.x - pet.x;
  const dy = leader.y - pet.y;
  const d = Math.hypot(dx, dy);
  if (d <= distance) return null;
  const k = (d - distance) / d;
  return { x: pet.x + dx * k, y: pet.y + dy * k };
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
