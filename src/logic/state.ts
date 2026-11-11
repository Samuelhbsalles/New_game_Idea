import type { Clock } from './clock';
import type { Config, Creature, GameState, Shift } from './types';

/** Version written into every save. Bump when the save format changes. */
export const SAVE_VERSION = 1;

/**
 * Builds a fresh game from the start config. Starting creatures get full
 * energy and ids "c1", "c2", ...
 * @example const state = newGame(config, clock);
 */
export function newGame(config: Config, clock: Clock): GameState {
  const now = clock.now();
  const creatures: Creature[] = config.start.creatures.map((speciesId, i) => {
    const species = config.species.find((s) => s.id === speciesId);
    if (!species) throw new Error(`Unknown start species "${speciesId}"`);
    return { id: `c${i + 1}`, speciesId, energy: species.maxEnergy, energyAt: now, status: 'idle' };
  });
  return {
    saveVersion: SAVE_VERSION,
    coins: config.start.coins,
    inventory: { ...config.start.inventory },
    creatures,
    shifts: [],
  };
}

/**
 * Serialises state to a string for Storage.
 * @example storage.save(serialize(state));
 */
export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

const STATUSES = ['idle', 'working', 'resting'];

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Parses and validates a saved string. Returns null (never throws) when the
 * data is missing, not JSON, a different saveVersion, or malformed.
 * @example const state = deserialize(storage.load()) ?? newGame(config, clock);
 */
export function deserialize(data: string | null): GameState | null {
  if (data === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch {
    return null;
  }
  if (!isObj(raw) || raw.saveVersion !== SAVE_VERSION) return null;
  if (!isNum(raw.coins) || !isObj(raw.inventory)) return null;
  if (!Object.values(raw.inventory).every(isNum)) return null;
  if (!Array.isArray(raw.creatures) || !Array.isArray(raw.shifts)) return null;
  const creaturesOk = raw.creatures.every(
    (c) =>
      isObj(c) &&
      typeof c.id === 'string' &&
      typeof c.speciesId === 'string' &&
      isNum(c.energy) &&
      isNum(c.energyAt) &&
      typeof c.status === 'string' &&
      STATUSES.includes(c.status),
  );
  const shiftsOk = raw.shifts.every(
    (s) =>
      isObj(s) &&
      typeof s.shopId === 'string' &&
      isNum(s.slot) &&
      typeof s.creatureId === 'string' &&
      isNum(s.startedAt) &&
      isNum(s.endsAt),
  );
  if (!creaturesOk || !shiftsOk) return null;
  return raw as unknown as GameState;
}

/** True when the shift's end time has been reached at `nowMs`. */
export function isShiftDone(shift: Shift, nowMs: number): boolean {
  return nowMs >= shift.endsAt;
}
