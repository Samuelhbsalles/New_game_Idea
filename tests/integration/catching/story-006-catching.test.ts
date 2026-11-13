import { describe, expect, it } from 'vitest';
import catchingJson from '../../../src/data/catching.json';
import creatures from '../../../src/data/creatures.json';
import items from '../../../src/data/items.json';
import shops from '../../../src/data/shops.json';
import start from '../../../src/data/start.json';
import time from '../../../src/data/time.json';
import { attemptCatch, baitCount, parseCatchRules } from '../../../src/logic/catching';
import { createFakeClock } from '../../../src/logic/clock';
import { parseConfig } from '../../../src/logic/config';
import { Game } from '../../../src/logic/game';
import { MemoryStorage } from '../../../src/logic/memoryStorage';

const T = 1_700_000_000_000;
const config = parseConfig({ species: creatures, shops, items, start, time });
const speciesIds = creatures.map((c) => c.id);
const rules = parseCatchRules(catchingJson, speciesIds);
const always = () => 0;
const never = () => 0.999;

function fresh(storage = new MemoryStorage()) {
  return Game.create(config, createFakeClock(T), storage);
}

describe('story-006 catching', () => {
  it('AC1: the shipped rules cover rabbit, pigeon, cat and monkey, with spawn rules for the park', () => {
    expect(Object.keys(rules.species).sort()).toEqual(['cat', 'monkey', 'pigeon', 'rabbit']);
    expect(rules.spawns.length).toBeGreaterThan(0);
  });

  it('AC2: bait catches a common creature (chance 1) every time', () => {
    const game = fresh();
    for (let i = 0; i < 3; i++) expect(attemptCatch(game, rules, 'pigeon', never).ok).toBe(true);
  });

  it('AC3: one bait is consumed per attempt, including a failed one', () => {
    const game = fresh();
    const before = baitCount(game, rules);
    attemptCatch(game, rules, 'pigeon', always);
    expect(baitCount(game, rules)).toBe(before - 1);
    const strict = { ...rules, species: { ...rules.species, pigeon: { chance: 0 } } };
    const r = attemptCatch(game, strict, 'pigeon', always);
    expect(r).toEqual({ ok: false, reason: 'escaped' });
    expect(baitCount(game, rules)).toBe(before - 2);
  });

  it('AC4: with no bait nothing is attempted and nothing changes', () => {
    const game = fresh();
    game.state.inventory[rules.baitItemId] = 0;
    const roster = game.state.creatures.length;
    expect(attemptCatch(game, rules, 'pigeon', always)).toEqual({ ok: false, reason: 'no_bait' });
    expect(game.state.creatures.length).toBe(roster);
    expect(baitCount(game, rules)).toBe(0);
  });

  it('AC5: a caught creature joins the roster idle at full energy and survives save/load', () => {
    const storage = new MemoryStorage();
    const game = fresh(storage);
    const r = attemptCatch(game, rules, 'pigeon', always);
    if (!r.ok) throw new Error('expected a catch');
    expect(r.creature).toMatchObject({ speciesId: 'pigeon', status: 'idle', energy: config.species.find((s) => s.id === 'pigeon')!.maxEnergy });
    expect(game.state.creatures.map((c) => c.id)).toContain(r.creature.id);
    game.save();
    const loaded = Game.load(config, createFakeClock(T), storage);
    expect(loaded.state.creatures.find((c) => c.id === r.creature.id)?.speciesId).toBe('pigeon');
  });

  it('AC5b: new creatures get unique ids', () => {
    const game = fresh();
    const a = attemptCatch(game, rules, 'pigeon', always);
    const b = attemptCatch(game, rules, 'rabbit', always);
    if (!a.ok || !b.ok) throw new Error('expected catches');
    const ids = game.state.creatures.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('AC6: the first catch of a species marks it for the album, later ones do not', () => {
    const storage = new MemoryStorage();
    const game = fresh(storage);
    const first = attemptCatch(game, rules, 'pigeon', always);
    const second = attemptCatch(game, rules, 'pigeon', always);
    expect(first.ok && first.firstOfSpecies).toBe(true);
    expect(second.ok && second.firstOfSpecies).toBe(false);
    game.save();
    expect(Game.load(config, createFakeClock(T), storage).state.caught).toEqual(['pigeon']);
  });

  it('refuses species that are not catchable, without using bait', () => {
    const game = fresh();
    const before = baitCount(game, rules);
    expect(attemptCatch(game, rules, 'dragon', always)).toEqual({ ok: false, reason: 'not_catchable' });
    expect(baitCount(game, rules)).toBe(before);
  });

  it('rejects rules with an unknown species or a chance above 1', () => {
    expect(() => parseCatchRules({ ...catchingJson, species: { dragon: { chance: 1 } } }, speciesIds)).toThrow(/dragon/);
    expect(() => parseCatchRules({ ...catchingJson, species: { pigeon: { chance: 2 } }, spawns: [] }, speciesIds)).toThrow(/chance/);
  });
});
