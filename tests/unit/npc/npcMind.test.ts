import { describe, expect, it } from 'vitest';
import { bump, buildNavGrid, calmDown, decideNext, findPath, type NpcPersona } from '../../../src/logic/npcMind';

const fixed = (v: number) => () => v;

describe('nav grid and paths', () => {
  // 10x6 cells of 10px with a wall down the middle except a gap at the bottom row.
  const grid = buildNavGrid(100, 60, 10, [{ x: 50, y: 0, w: 10, h: 50 }], 0);

  it('blocks only cells the solid overlaps', () => {
    expect(grid.free[0][5]).toBe(false);
    expect(grid.free[4][5]).toBe(false);
    expect(grid.free[5][5]).toBe(true);
    expect(grid.free[0][4]).toBe(true);
  });

  it('grows solids by the walker pad', () => {
    const padded = buildNavGrid(100, 60, 10, [{ x: 50, y: 0, w: 10, h: 50 }], 5);
    expect(padded.free[0][4]).toBe(false);
    expect(padded.free[0][6]).toBe(false);
  });

  it('routes around the wall through the gap and ends exactly at the target', () => {
    const path = findPath(grid, { x: 15, y: 15 }, { x: 85, y: 15 });
    expect(path.length).toBeGreaterThan(1);
    expect(path[path.length - 1]).toEqual({ x: 85, y: 15 });
    // It must pass through the gap row (y 50-60) to cross the wall.
    expect(path.some((p) => p.y >= 50)).toBe(true);
    // No waypoint lies inside the wall.
    expect(path.some((p) => p.x >= 50 && p.x < 60 && p.y < 50)).toBe(false);
  });

  it('returns nothing when the target is sealed off', () => {
    const sealed = buildNavGrid(100, 60, 10, [{ x: 50, y: 0, w: 10, h: 60 }], 0);
    // The nearest free cell to the target is on its own side, so a sealed wall means no route.
    expect(findPath(sealed, { x: 15, y: 15 }, { x: 85, y: 15 })).toEqual([]);
  });
});

describe('npc decisions', () => {
  const persona: NpcPersona = {
    home: 'home',
    favorites: ['bakery', 'cafe'],
    weights: { visit: 1, home: 1, stroll: 1, idle: 1 },
    insideMs: [1000, 2000],
    idleMs: [1000, 3000],
    temper: 3,
  };

  it('picks by weight: low roll visits, high roll idles', () => {
    expect(decideNext(persona, null, fixed(0)).kind).toBe('visit');
    expect(decideNext(persona, null, fixed(0.99)).kind).toBe('idle');
  });

  it('never revisits the building it just left and never goes home from home', () => {
    for (const r of [0, 0.1, 0.2, 0.3, 0.45, 0.6, 0.9]) {
      const plan = decideNext(persona, 'bakery', fixed(r));
      if (plan.kind === 'visit') expect(plan.building).toBe('cafe');
      expect(decideNext(persona, 'home', fixed(r)).kind).not.toBe('home');
    }
  });

  it('idles for a duration inside its range', () => {
    const plan = decideNext(persona, null, fixed(0.99));
    expect(plan.kind === 'idle' && plan.ms >= 1000 && plan.ms <= 3000).toBe(true);
  });
});

describe('npc mood', () => {
  it('gets angry exactly when bumps reach its temper', () => {
    let m = { annoyance: 0 };
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const r = bump(m, 3);
      m = r.mood;
      results.push(r.angry);
    }
    expect(results).toEqual([false, false, true, false]);
  });

  it('calms down over time but never below zero', () => {
    expect(calmDown({ annoyance: 1 }, 2000).annoyance).toBeCloseTo(0.5);
    expect(calmDown({ annoyance: 0.1 }, 10_000).annoyance).toBe(0);
  });
});
