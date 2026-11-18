import { describe, expect, it } from 'vitest';
import { energyNow, settleEnergy, shiftEnergyCost, type EnergyRules } from '../../../src/logic/energy';
import type { Creature } from '../../../src/logic/types';

/** 10 energy per in-game hour, double asleep; one in-game hour = 1000 ms here. */
const R: EnergyRules = { perGameHour: 10, sleepMultiplier: 2, gameHourMs: 1000 };
const creature = (over: Partial<Creature> = {}): Creature => ({ id: 'c1', speciesId: 'rabbit', energy: 50, energyAt: 0, status: 'idle', ...over });

describe('energy', () => {
  it('a workplace costs its base for an ordinary creature', () => {
    expect(shiftEnergyCost(25, 1)).toBe(25);
  });

  it('a creature good at the job tires less, a bad one more', () => {
    expect(shiftEnergyCost(25, 4)).toBe(13); // 25 / 2
    expect(shiftEnergyCost(25, 0.5)).toBe(38); // 25 x 1.5
    expect(shiftEnergyCost(1, 100)).toBe(1); // never free
  });

  it('comes back over time when not working, capped at max', () => {
    expect(energyNow(creature(), 100, 2000, R)).toBe(70);
    expect(energyNow(creature(), 100, 99_000, R)).toBe(100);
  });

  it('comes back twice as fast asleep, and not at all while working', () => {
    expect(energyNow(creature({ status: 'resting' }), 100, 2000, R)).toBe(90);
    expect(energyNow(creature({ status: 'working' }), 100, 2000, R)).toBe(50);
  });

  it('settling writes the current energy and restarts the clock', () => {
    const c = creature();
    settleEnergy(c, 100, 3000, R);
    expect(c).toMatchObject({ energy: 80, energyAt: 3000 });
  });
});
