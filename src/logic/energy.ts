/**
 * Creature energy (user decisions 2026-11-16): work costs energy (light /
 * medium / heavy workplaces, adjusted by how good the creature is there), it
 * comes back over time when not working (twice as fast asleep in the pet bed),
 * food restores it at once, and a creature without enough energy for a whole
 * shift can't start one. Energy is stored as (energy, energyAt) and the
 * current value is worked out from the time passed. Render-independent.
 */
import type { Creature } from './types';

/** How energy comes back (src/data/time.json). */
export interface EnergyRules {
  /** Energy regained per in-game hour while not working. */
  perGameHour: number;
  /** Faster while asleep ('resting' = in the pet bed). */
  sleepMultiplier: number;
  /** Real milliseconds in one in-game hour. */
  gameHourMs: number;
}

/**
 * Energy a shift costs this creature: the workplace's cost, less for a
 * creature good there (cost / sqrt(affinity): x4 halves it), more for one bad
 * there (cost x (2 - affinity): x0.5 costs half again). Whole numbers, at least 1.
 */
export function shiftEnergyCost(workplaceCost: number, affinity: number): number {
  const a = Math.max(0, affinity);
  const cost = a >= 1 ? workplaceCost / Math.sqrt(a) : workplaceCost * (2 - a);
  return Math.max(1, Math.round(cost));
}

/** Energy right now: no gain while working; otherwise regained since energyAt, capped at max. */
export function energyNow(c: Pick<Creature, 'energy' | 'energyAt' | 'status'>, maxEnergy: number, now: number, rules: EnergyRules): number {
  if (c.status === 'working') return Math.min(maxEnergy, c.energy);
  const hours = Math.max(0, now - c.energyAt) / rules.gameHourMs;
  const rate = rules.perGameHour * (c.status === 'resting' ? rules.sleepMultiplier : 1);
  return Math.min(maxEnergy, c.energy + hours * rate);
}

/** Writes the current energy into the creature (call before changing its status or energy). */
export function settleEnergy(c: Creature, maxEnergy: number, now: number, rules: EnergyRules): void {
  c.energy = energyNow(c, maxEnergy, now, rules);
  c.energyAt = now;
}
