import { describe, expect, it } from 'vitest';
import wildJson from '../../../src/data/wild.json';
import { climbAlpha, climbStep, nearestTree, parseWildRules, trunkFront, type ClimberRules } from '../../../src/logic/climb';

/** A climber with round numbers: 60px up at 30px/s. */
const RULES: ClimberRules = { height: 60, speed: 30, chance: 0.5, hideMs: [1000, 2000], treeRange: 100, frontDy: 4 };

describe('tree climbing', () => {
  it('the shipped wild.json is valid and has the squirrel climbing', () => {
    const w = parseWildRules(wildJson);
    expect(w.climbers.squirrel).toBeDefined();
    expect(w.treeSprites.length).toBeGreaterThan(0);
  });

  it('refuses a chance above 1 and a reversed hide range', () => {
    expect(() => parseWildRules({ treeSprites: [], climbers: { s: { ...RULES, chance: 2 } } })).toThrow(/chance/);
    expect(() => parseWildRules({ treeSprites: [], climbers: { s: { ...RULES, hideMs: [5, 1] } } })).toThrow(/hideMs/);
  });

  it('picks the closest tree in range, or none', () => {
    const trees = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ];
    expect(nearestTree({ x: 40, y: 0 }, trees, 100)).toEqual({ x: 50, y: 0 });
    expect(nearestTree({ x: 400, y: 0 }, trees, 100)).toBeNull();
  });

  it('stands just in front of the trunk', () => {
    expect(trunkFront({ x: 10, y: 20 }, RULES)).toEqual({ x: 10, y: 24 });
  });

  it('climbs up at its speed and stops at the top', () => {
    expect(climbStep(0, 1, RULES, 1000)).toEqual({ up: 30, done: false });
    expect(climbStep(45, 1, RULES, 1000)).toEqual({ up: 60, done: true });
  });

  it('climbs back down and stops on the ground', () => {
    expect(climbStep(60, -1, RULES, 1000)).toEqual({ up: 30, done: false });
    expect(climbStep(10, -1, RULES, 1000)).toEqual({ up: 0, done: true });
  });

  it('fades only over the top third, gone at the top', () => {
    expect(climbAlpha(0, RULES)).toBe(1);
    expect(climbAlpha(40, RULES)).toBe(1);
    expect(climbAlpha(50, RULES)).toBeCloseTo(0.5);
    expect(climbAlpha(60, RULES)).toBe(0);
  });
});
