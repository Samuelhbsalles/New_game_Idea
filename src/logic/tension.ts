/**
 * The catching minigame (user's choice 2026-11-15: "barra de tensão"): a bar
 * with a green zone that wanders as the creature tugs, and a marker the player
 * lifts by HOLDING the action key (it falls when released). Inside the zone
 * the catch meter fills, outside it drains: full = caught, empty or out of
 * time = it got away. Pure and deterministic for a given rng.
 */

/** Per-rarity feel of the minigame (src/data/lure.json "tension"). Positions are 0 (bottom) to 1 (top). */
export interface TensionTuning {
  /** Height of the green zone. */
  zoneWidth: number;
  /** How fast the zone slides to its next spot (per second). */
  zoneSpeed: number;
  /** How often the creature tugs the zone somewhere new (ms), random in range. */
  jumpEveryMs: [number, number];
  /** Upward acceleration while holding (per s^2). */
  lift: number;
  /** Downward acceleration while not holding (per s^2). */
  gravity: number;
  /** Catch meter filled per second inside the zone. */
  fill: number;
  /** Catch meter lost per second outside the zone. */
  drain: number;
  /** Meter at the start (0-1). */
  start: number;
  /** Give up after this long (ms). */
  maxMs: number;
  /** At the start the meter does not drain for this long (ms): time to react. */
  graceMs: number;
}

export interface TensionState {
  marker: number;
  velocity: number;
  /** Centre of the green zone. */
  zone: number;
  /** Where the zone is sliding to. */
  zoneTarget: number;
  /** Time until the next tug (ms). */
  nextJumpMs: number;
  /** Catch meter, 0-1. */
  progress: number;
  elapsedMs: number;
}

export type TensionResult = 'playing' | 'caught' | 'escaped';

/** Fastest the marker can move (per second), so it stays catchable. */
const MAX_SPEED = 1.2;

const between = ([lo, hi]: [number, number], rng: () => number) => lo + rng() * (hi - lo);
/** A zone centre that keeps the whole zone on the bar. */
const zoneSpot = (t: TensionTuning, rng: () => number) => t.zoneWidth / 2 + rng() * (1 - t.zoneWidth);

/** A fresh round: marker at the bottom, zone somewhere on the bar. */
export function startTension(t: TensionTuning, rng: () => number): TensionState {
  const zone = zoneSpot(t, rng);
  return { marker: 0, velocity: 0, zone, zoneTarget: zone, nextJumpMs: between(t.jumpEveryMs, rng), progress: t.start, elapsedMs: 0 };
}

/** True when the marker is inside the green zone. */
export function inZone(s: TensionState, t: TensionTuning): boolean {
  return Math.abs(s.marker - s.zone) <= t.zoneWidth / 2;
}

/** Advances the round by dtMs with the key held or not. */
export function stepTension(s: TensionState, t: TensionTuning, holding: boolean, dtMs: number, rng: () => number): { state: TensionState; result: TensionResult } {
  const dt = dtMs / 1000;
  // Marker: lifted while held, falls when released, stops at the ends.
  let velocity = s.velocity + (holding ? t.lift : -t.gravity) * dt;
  velocity = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, velocity));
  let marker = s.marker + velocity * dt;
  if (marker <= 0 || marker >= 1) {
    marker = Math.max(0, Math.min(1, marker));
    velocity = 0;
  }
  // Zone: slides toward its target; the creature tugs it somewhere new now and then.
  let { zoneTarget, nextJumpMs } = s;
  nextJumpMs -= dtMs;
  if (nextJumpMs <= 0) {
    zoneTarget = zoneSpot(t, rng);
    nextJumpMs = between(t.jumpEveryMs, rng);
  }
  const gap = zoneTarget - s.zone;
  const slide = t.zoneSpeed * dt;
  const zone = Math.abs(gap) <= slide ? zoneTarget : s.zone + Math.sign(gap) * slide;
  const next: TensionState = { marker, velocity, zone, zoneTarget, nextJumpMs, progress: s.progress, elapsedMs: s.elapsedMs + dtMs };
  const draining = next.elapsedMs > t.graceMs;
  const change = inZone(next, t) ? t.fill : draining ? -t.drain : 0;
  next.progress = Math.max(0, Math.min(1, s.progress + change * dt));
  if (next.progress >= 1) return { state: next, result: 'caught' };
  if (next.progress <= 0 || next.elapsedMs >= t.maxMs) return { state: next, result: 'escaped' };
  return { state: next, result: 'playing' };
}
