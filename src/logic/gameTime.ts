/** How in-game time maps onto real time (src/data/time.json). */
export interface TimeConfig {
  /** Real milliseconds in one in-game day. */
  dayMs: number;
  /** Hour of day (0-23) at the moment a new world starts. */
  startHour: number;
  /** Night runs from nightStartHour to dayStartHour (wrapping past midnight). */
  nightStartHour: number;
  dayStartHour: number;
  /** Energy a creature regains per in-game hour when not working (src/logic/energy.ts). */
  energyPerGameHour: number;
  /** Recovery is this many times faster asleep in the pet bed. */
  sleepEnergyMultiplier: number;
}

/** A moment in game time. */
export interface GameTime {
  /** Day number, starting at 1. */
  day: number;
  /** Hour of day, 0-23. */
  hour: number;
  /** Minute of hour, 0-59. */
  minute: number;
}

/**
 * Validates raw time JSON. Throws naming the bad field.
 * @example const time = parseTimeConfig(timeJson);
 */
export function parseTimeConfig(raw: unknown): TimeConfig {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('Invalid config at time: expected object');
  const o = raw as Record<string, unknown>;
  const dayMs = o.dayMs;
  const startHour = o.startHour;
  if (typeof dayMs !== 'number' || !Number.isFinite(dayMs) || dayMs < 24) throw new Error('Invalid config at time.dayMs: expected number >= 24');
  if (typeof startHour !== 'number' || !Number.isInteger(startHour) || startHour < 0 || startHour > 23) {
    throw new Error('Invalid config at time.startHour: expected integer 0-23');
  }
  const hour = (k: 'nightStartHour' | 'dayStartHour') => {
    const v = o[k];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 23) throw new Error(`Invalid config at time.${k}: expected integer 0-23`);
    return v;
  };
  const positive = (k: 'energyPerGameHour' | 'sleepEnergyMultiplier') => {
    const v = o[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new Error(`Invalid config at time.${k}: expected number >= 0`);
    return v;
  };
  return {
    dayMs,
    startHour,
    nightStartHour: hour('nightStartHour'),
    dayStartHour: hour('dayStartHour'),
    energyPerGameHour: positive('energyPerGameHour'),
    sleepEnergyMultiplier: positive('sleepEnergyMultiplier'),
  };
}

/** True at night: from nightStartHour until dayStartHour. */
export function isNight(t: GameTime, cfg: TimeConfig): boolean {
  return cfg.nightStartHour > cfg.dayStartHour
    ? t.hour >= cfg.nightStartHour || t.hour < cfg.dayStartHour
    : t.hour >= cfg.nightStartHour && t.hour < cfg.dayStartHour;
}

/** Real milliseconds in `hours` in-game hours. */
export function gameHoursToMs(hours: number, cfg: TimeConfig): number {
  return (hours * cfg.dayMs) / 24;
}

/**
 * The in-game day and time at `nowMs` for a world that started at `worldStartAt`.
 * Time keeps running while the game is closed, since it is derived from timestamps.
 * @example gameTimeAt(start + cfg.dayMs, start, cfg); // { day: 2, hour: cfg.startHour, minute: 0 }
 */
export function gameTimeAt(nowMs: number, worldStartAt: number, cfg: TimeConfig): GameTime {
  const minuteMs = cfg.dayMs / (24 * 60);
  const minutes = Math.floor(Math.max(0, nowMs - worldStartAt) / minuteMs) + cfg.startHour * 60;
  return { day: Math.floor(minutes / (24 * 60)) + 1, hour: Math.floor(minutes / 60) % 24, minute: minutes % 60 };
}
