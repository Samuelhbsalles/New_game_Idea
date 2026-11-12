import { describe, expect, it } from 'vitest';
import { nextDelay, planBird, strollStep, type Pt, type StrollState } from '../../../src/logic/ambient';

const ROUTE: Pt[] = [
  { x: 100, y: 0 },
  { x: 100, y: 100 },
];
const fixed = (v: number) => () => v;

function start(): StrollState {
  return { pos: { x: 0, y: 0 }, target: 0, waitMs: 0 };
}

describe('NPC stroll', () => {
  it('walks towards the current route point at speed px/s', () => {
    // 50 px/s for 1000 ms = 50 px towards (100, 0)
    const r = strollStep(start(), ROUTE, 50, [0, 0], 1000, fixed(0));
    expect(r.state.pos).toEqual({ x: 50, y: 0 });
    expect(r.dx).toBe(50);
    expect(r.state.target).toBe(0);
  });

  it('stops on the point, picks a pause and aims at the next point', () => {
    const r = strollStep({ ...start(), pos: { x: 95, y: 0 } }, ROUTE, 50, [1000, 3000], 1000, fixed(0.5));
    expect(r.state.pos).toEqual({ x: 100, y: 0 });
    expect(r.state.target).toBe(1);
    expect(r.state.waitMs).toBe(2000);
  });

  it('stands still while waiting, then walks again', () => {
    const waiting = { pos: { x: 100, y: 0 }, target: 1, waitMs: 500 };
    const a = strollStep(waiting, ROUTE, 50, [0, 0], 400, fixed(0));
    expect(a).toMatchObject({ dx: 0, dy: 0, state: { waitMs: 100, pos: { x: 100, y: 0 } } });
    const b = strollStep(a.state, ROUTE, 50, [0, 0], 400, fixed(0));
    expect(b.state.waitMs).toBe(0);
    const c = strollStep(b.state, ROUTE, 50, [0, 0], 400, fixed(0));
    expect(c.state.pos).toEqual({ x: 100, y: 20 });
  });

  it('loops back to the first point after the last', () => {
    const r = strollStep({ pos: { x: 100, y: 99 }, target: 1, waitMs: 0 }, ROUTE, 50, [0, 0], 1000, fixed(0));
    expect(r.state.target).toBe(0);
  });

  it('does nothing on an empty route', () => {
    const s = start();
    expect(strollStep(s, [], 50, [0, 0], 1000, fixed(0))).toEqual({ state: s, dx: 0, dy: 0 });
  });
});

describe('birds', () => {
  it('crosses from off-screen left to off-screen right when the coin says so', () => {
    const f = planBird(400, 200, [100, 100], 20, fixed(0.25));
    expect(f.from.x).toBe(-20);
    expect(f.to.x).toBe(420);
    expect(f.from.y).toBeGreaterThanOrEqual(0);
    expect(f.from.y).toBeLessThanOrEqual(200);
    // distance / 100 px/s
    expect(f.durationMs).toBeCloseTo((Math.hypot(f.to.x - f.from.x, f.to.y - f.from.y) / 100) * 1000);
  });

  it('crosses right to left on the other side of the coin, staying inside the height', () => {
    const f = planBird(400, 200, [80, 120], 20, fixed(0.9));
    expect(f.from.x).toBe(420);
    expect(f.to.x).toBe(-20);
    expect(f.to.y).toBeGreaterThanOrEqual(0);
    expect(f.to.y).toBeLessThanOrEqual(200);
  });

  it('picks the next delay inside its range', () => {
    expect(nextDelay([1000, 3000], fixed(0))).toBe(1000);
    expect(nextDelay([1000, 3000], fixed(0.5))).toBe(2000);
  });
});
