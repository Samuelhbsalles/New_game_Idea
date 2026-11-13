import { describe, expect, it } from 'vitest';
import catchingJson from '../../../src/data/catching.json';
import creatures from '../../../src/data/creatures.json';
import items from '../../../src/data/items.json';
import shops from '../../../src/data/shops.json';
import start from '../../../src/data/start.json';
import time from '../../../src/data/time.json';
import { coverage, eligibleSpecies, parseCatchRules, pickSpawn } from '../../../src/logic/catching';
import { parseConfig } from '../../../src/logic/config';
import { gameTimeAt, isNight, parseTimeConfig } from '../../../src/logic/gameTime';

const raw = { species: creatures, shops, items, start, time };
const config = parseConfig(raw);
const rules = parseCatchRules(catchingJson, config.species, items.map((i) => i.id));
const day = { night: false, weather: 'clear' };
const night = { night: true, weather: 'clear' };

describe('creatures (design/creatures.md)', () => {
  it('ships the 27 creatures of the design list plus the monkey', () => {
    expect(config.species).toHaveLength(28);
    const counts = (r: string) => config.species.filter((s) => s.rarity === r).length;
    expect([counts('common'), counts('uncommon'), counts('rare'), counts('epic')]).toEqual([8, 9, 8, 3]);
  });

  it('every creature but the generalist rabbit has a strength and a weakness', () => {
    for (const s of config.species) {
      const m = Object.values(s.affinities);
      if (s.generalist) continue;
      expect(m.some((x) => x > 1), `${s.id} strength`).toBe(true);
      expect(m.some((x) => x < 1), `${s.id} weakness`).toBe(true);
    }
    expect(config.species.filter((s) => s.generalist).map((s) => s.id)).toEqual(['rabbit']);
  });

  it('rejects a creature without a weakness, and one with an unknown bait', () => {
    const noWeak = creatures.map((c) => (c.id === 'cat' ? { ...c, affinities: { cafe: 3 } } : c));
    expect(() => parseConfig({ ...raw, species: noWeak })).toThrow(/cat.*weakness/);
    const badBait = creatures.map((c) => (c.id === 'cat' ? { ...c, baitId: 'caviar' } : c));
    expect(() => parseConfig({ ...raw, species: badBait })).toThrow(/baitId/);
  });

  it('every workplace has at least one creature good at it (coverage report)', () => {
    const cov = coverage(config.species, config.shops.map((s) => s.id));
    for (const [shop, c] of Object.entries(cov)) expect(c.strong.length, shop).toBeGreaterThan(0);
    expect(cov.cafe.strong[0]).toBe('cat'); // cafe 3x, the best there
  });
});

describe('who appears where', () => {
  it('only species of that area, at the right time of day, with the right weather', () => {
    const park = (ctx: typeof day) => eligibleSpecies(config.species, 'park', ctx).map((s) => s.id);
    expect(park(day)).toContain('rabbit');
    expect(park(day)).not.toContain('firefly');
    expect(park(night)).toContain('firefly');
    expect(eligibleSpecies(config.species, 'lake', night).map((s) => s.id)).not.toContain('axolotl'); // needs rain too
    expect(eligibleSpecies(config.species, 'lake', { night: true, weather: 'rain' }).map((s) => s.id)).toContain('axolotl');
  });

  it('picks by rarity weight: a common is far likelier than an uncommon', () => {
    const pool = config.species.filter((s) => s.id === 'rabbit' || s.id === 'sloth'); // common vs uncommon
    const w = rules.rarities;
    const cut = w.common.weight / (w.common.weight + w.uncommon.weight);
    expect(pickSpawn(rules, pool, () => cut - 0.001)?.id).toBe('rabbit');
    expect(pickSpawn(rules, pool, () => cut + 0.001)?.id).toBe('sloth');
    expect(pickSpawn(rules, [], () => 0)).toBeNull();
  });

  it('night is from nightStartHour until dayStartHour', () => {
    const cfg = parseTimeConfig(time);
    const at = (hour: number) => isNight(gameTimeAt(((hour - cfg.startHour + 24) % 24) * (cfg.dayMs / 24), 0, cfg), cfg);
    expect(at(12)).toBe(false);
    expect(at(cfg.nightStartHour)).toBe(true);
    expect(at(2)).toBe(true);
    expect(at(cfg.dayStartHour)).toBe(false);
  });
});
