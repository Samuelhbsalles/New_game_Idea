import { describe, expect, it } from 'vitest';
import lureJson from '../../../src/data/lure.json';
import catchingJson from '../../../src/data/catching.json';
import { noticeRadius, parseLureRules, spooked, temperOf, tensionFor, type Temper } from '../../../src/logic/lure';
import { inZone, startTension, stepTension, type TensionTuning } from '../../../src/logic/tension';

const RARITIES = Object.keys(catchingJson.rarities);
const rules = () => parseLureRules(lureJson, RARITIES);

/** A minigame with round numbers: zone 0.4 tall, no drift, meter 0.5 at start. */
const T: TensionTuning = { zoneWidth: 0.4, zoneSpeed: 0, jumpEveryMs: [10_000, 10_000], lift: 3, gravity: 3, fill: 0.5, drain: 0.5, start: 0.5, maxMs: 20_000, graceMs: 0 };
/** rng that always returns the middle, so the zone starts centred at 0.5. */
const mid = () => 0.5;

describe('bait rules (lure.json)', () => {
  it('the shipped lure.json is valid and tunes every rarity', () => {
    const r = rules();
    for (const id of RARITIES) expect(r.tension[id]).toBeDefined();
  });

  it('refuses a missing rarity and an unknown temper', () => {
    expect(() => parseLureRules(lureJson, [...RARITIES, 'mythic'])).toThrow(/tension\.mythic/);
    expect(() => parseLureRules({ ...lureJson, species: { cat: 'grumpy' } }, RARITIES)).toThrow(/species\.cat/);
  });

  it('each species has its temper; unknown ones are curious', () => {
    const r = rules();
    expect(temperOf(r, 'capybara')).toBe(r.tempers.calm);
    expect(temperOf(r, 'armadillo')).toBe(r.tempers.shy);
    expect(temperOf(r, 'dragon')).toBe(r.tempers.curious);
  });

  it('its own bait is noticed from farther and widens the catch zone', () => {
    const r = rules();
    expect(noticeRadius(r, true)).toBeGreaterThan(noticeRadius(r, false));
    expect(tensionFor(r, 'rare', true).zoneWidth).toBeGreaterThan(tensionFor(r, 'rare', false).zoneWidth);
  });

  it('rarer creatures have a smaller zone (harder)', () => {
    const r = rules();
    const widths = RARITIES.map((id) => r.tension[id].zoneWidth);
    expect([...widths].sort((a, b) => b - a)).toEqual(widths);
  });
});

describe('spooking (red light, green light)', () => {
  const temper: Temper = { lookEveryMs: [1000, 1000], lookMs: [500, 500], speed: 10, fleeDistance: 30 };

  it('moving while it looks scares it; moving while it does not is fine', () => {
    expect(spooked(temper, { looking: true, playerMoving: true, playerDistance: 100 })).toBe('moved');
    expect(spooked(temper, { looking: false, playerMoving: true, playerDistance: 100 })).toBeNull();
    expect(spooked(temper, { looking: true, playerMoving: false, playerDistance: 100 })).toBeNull();
  });

  it('standing too close always scares it', () => {
    expect(spooked(temper, { looking: false, playerMoving: false, playerDistance: 29 })).toBe('too_close');
    expect(spooked(temper, { looking: false, playerMoving: false, playerDistance: 30 })).toBeNull();
  });
});

describe('tension minigame', () => {
  it('starts with the marker at the bottom and the meter at its start value', () => {
    const s = startTension(T, mid);
    expect(s.marker).toBe(0);
    expect(s.progress).toBe(0.5);
    expect(s.zone).toBe(0.5);
  });

  it('holding lifts the marker; releasing lets it fall back to the floor', () => {
    let s = startTension(T, mid);
    for (let i = 0; i < 10; i++) s = stepTension(s, T, true, 50, mid).state;
    const lifted = s.marker;
    expect(lifted).toBeGreaterThan(0.3);
    for (let i = 0; i < 40; i++) s = stepTension(s, T, false, 50, mid).state;
    expect(s.marker).toBe(0);
  });

  it('the meter fills inside the zone and the round is won when full', () => {
    const s = { ...startTension(T, mid), marker: 0.5 };
    expect(inZone(s, T)).toBe(true);
    const r = stepTension(s, T, false, 100, mid);
    expect(r.state.progress).toBeCloseTo(0.55, 5);
    expect(stepTension({ ...s, progress: 0.99 }, T, false, 100, mid).result).toBe('caught');
  });

  it('the meter drains outside the zone and the creature escapes when empty', () => {
    const s = { ...startTension(T, mid), marker: 0 };
    expect(inZone(s, T)).toBe(false);
    expect(stepTension(s, T, false, 100, mid).state.progress).toBeCloseTo(0.45, 5);
    expect(stepTension({ ...s, progress: 0.01 }, T, false, 100, mid).result).toBe('escaped');
  });

  it('during the grace time at the start the meter does not drain', () => {
    const t = { ...T, graceMs: 1000 };
    const s = { ...startTension(t, mid), marker: 0 };
    const early = stepTension(s, t, false, 100, mid).state;
    expect(early.progress).toBe(0.5);
    const late = stepTension({ ...s, elapsedMs: 1000 }, t, false, 100, mid).state;
    expect(late.progress).toBeCloseTo(0.45, 5);
  });

  it('running out of time is an escape', () => {
    const s = { ...startTension(T, mid), marker: 0.5, elapsedMs: 19_950 };
    expect(stepTension(s, T, false, 100, mid).result).toBe('escaped');
  });

  it('the creature tugs the zone to a new spot, sliding at zoneSpeed', () => {
    const t = { ...T, zoneSpeed: 1, jumpEveryMs: [100, 100] as [number, number] };
    let s = startTension(t, mid);
    // Next tug picks the top of the bar (rng 1 -> centre 0.8 with a 0.4 zone).
    s = stepTension(s, t, false, 100, () => 1).state;
    expect(s.zoneTarget).toBeCloseTo(0.8, 5);
    expect(s.zone).toBeCloseTo(0.6, 5);
  });
});
