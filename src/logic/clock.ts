/** Source of time for all logic. Values are millisecond timestamps. */
export interface Clock {
  now(): number;
}

/**
 * Wall-clock time. The only place in the logic module allowed to call Date.now().
 * @example const game = Game.load(config, systemClock, storage);
 */
export const systemClock: Clock = { now: () => Date.now() };

/** A clock whose time only moves when told to; for deterministic tests. */
export interface FakeClock extends Clock {
  /** Moves time forward by `ms`. */
  advance(ms: number): void;
}

/**
 * Creates a manually driven clock.
 * @example const clock = createFakeClock(1000); clock.advance(500); clock.now(); // 1500
 */
export function createFakeClock(startMs = 0): FakeClock {
  let t = startMs;
  return {
    now: () => t,
    advance: (ms) => {
      t += ms;
    },
  };
}
