import { describe, expect, it } from 'vitest';
import catchingJson from '../../../src/data/catching.json';
import creatures from '../../../src/data/creatures.json';
import items from '../../../src/data/items.json';
import shops from '../../../src/data/shops.json';
import start from '../../../src/data/start.json';
import time from '../../../src/data/time.json';
import { attemptCatch, baitCount, baitFor, parseCatchRules } from '../../../src/logic/catching';
import { createFakeClock } from '../../../src/logic/clock';
import { parseConfig } from '../../../src/logic/config';
import { Game } from '../../../src/logic/game';
import { MemoryStorage } from '../../../src/logic/memoryStorage';

const T = 1_700_000_000_000;
const config = parseConfig({ species: creatures, shops, items, start, time });
const itemIds = items.map((i) => i.id);
const rules = parseCatchRules(catchingJson, config.species, itemIds);
const always = () => 0;
const never = () => 0.999;
const sp = (id: string) => config.species.find((s) => s.id === id)!;

/** A fresh game holding exactly these items. */
function fresh(inventory: Record<string, number> = { bait: 3 }, storage = new MemoryStorage()) {
  const game = Game.create(config, createFakeClock(T), storage);
  game.state.inventory = { ...inventory };
  return game;
}

describe('story-006 catching (bait per species, chance by rarity)', () => {
  it('AC1: every rarity has a rule and every species area is known', () => {
    expect(Object.keys(rules.rarities).sort()).toEqual(['common', 'epic', 'legendary', 'rare', 'uncommon']);
    for (const s of config.species) for (const a of s.areas) expect(rules.areas[a], `${s.id} area ${a}`).toBeDefined();
  });

  it('AC2: a common creature is caught every time with the generic bait', () => {
    const game = fresh({ bait: 3 });
    for (let i = 0; i < 3; i++) expect(attemptCatch(game, rules, 'pigeon', never).ok).toBe(true);
  });

  it('a species\' own bait is used before the generic one', () => {
    const game = fresh({ bait: 1, bread: 1 });
    const r = attemptCatch(game, rules, 'pigeon', always);
    expect(r.ok && r.baitUsed).toBe('bread');
    expect(game.state.inventory).toEqual({ bait: 1, bread: 0 });
  });

  it('an uncommon creature ignores the generic bait and asks for its own', () => {
    const game = fresh({ bait: 5 });
    expect(attemptCatch(game, rules, 'firefly', always)).toEqual({ ok: false, reason: 'no_bait', needs: sp('firefly').baitId });
    expect(game.state.inventory.bait).toBe(5);
    game.state.inventory.nectar = 1;
    expect(attemptCatch(game, rules, 'firefly', never).ok).toBe(true); // uncommon + own bait = guaranteed
  });

  it('a rare creature can escape even with its own bait (chance from its rarity)', () => {
    const game = fresh({ shellfish: 2 });
    const chance = rules.rarities.rare.specific;
    expect(baitFor(game, rules, 'octopus')).toEqual({ itemId: 'shellfish', chance });
    expect(attemptCatch(game, rules, 'octopus', () => chance)).toEqual({ ok: false, reason: 'escaped', baitUsed: 'shellfish' });
    expect(attemptCatch(game, rules, 'octopus', () => chance - 0.01).ok).toBe(true);
    expect(game.state.inventory.shellfish).toBe(0);
  });

  it('AC3: one bait is consumed per attempt, including a failed one', () => {
    const game = fresh({ bait: 3 });
    const strict = { ...rules, rarities: { ...rules.rarities, common: { ...rules.rarities.common, generic: 0.5 } } };
    expect(attemptCatch(game, strict, 'pigeon', never)).toEqual({ ok: false, reason: 'escaped', baitUsed: 'bait' });
    expect(baitCount(game, rules)).toBe(2);
  });

  it('AC4: with no usable bait nothing is attempted and nothing changes', () => {
    const game = fresh({});
    const roster = game.state.creatures.length;
    expect(attemptCatch(game, rules, 'pigeon', always)).toEqual({ ok: false, reason: 'no_bait', needs: 'bread' });
    expect(game.state.creatures.length).toBe(roster);
  });

  it('AC5: a caught creature joins the roster idle at full energy and survives save/load', () => {
    const storage = new MemoryStorage();
    const game = fresh({ bait: 1 }, storage);
    const r = attemptCatch(game, rules, 'pigeon', always);
    if (!r.ok) throw new Error('expected a catch');
    expect(r.creature).toMatchObject({ speciesId: 'pigeon', status: 'idle', energy: sp('pigeon').maxEnergy });
    game.save();
    const loaded = Game.load(config, createFakeClock(T), storage);
    expect(loaded.state.creatures.find((c) => c.id === r.creature.id)?.speciesId).toBe('pigeon');
  });

  it('AC5b: new creatures get unique ids', () => {
    const game = fresh({ bait: 2 });
    const a = attemptCatch(game, rules, 'pigeon', always);
    const b = attemptCatch(game, rules, 'rabbit', always);
    if (!a.ok || !b.ok) throw new Error('expected catches');
    const ids = game.state.creatures.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('AC6: the first catch of a species marks it for the album, later ones do not', () => {
    const storage = new MemoryStorage();
    const game = fresh({ bait: 2 }, storage);
    const first = attemptCatch(game, rules, 'pigeon', always);
    const second = attemptCatch(game, rules, 'pigeon', always);
    expect(first.ok && first.firstOfSpecies).toBe(true);
    expect(second.ok && second.firstOfSpecies).toBe(false);
    game.save();
    expect(Game.load(config, createFakeClock(T), storage).state.caught).toEqual(['pigeon']);
  });

  it('refuses unknown species without using bait', () => {
    const game = fresh({ bait: 1 });
    expect(attemptCatch(game, rules, 'dragon', always)).toEqual({ ok: false, reason: 'not_catchable' });
    expect(baitCount(game, rules)).toBe(1);
  });

  it('rejects rules with a chance above 1, a missing rarity or an unknown area', () => {
    const bad = (patch: object) => () => parseCatchRules({ ...catchingJson, ...patch }, config.species, itemIds);
    expect(bad({ rarities: { ...catchingJson.rarities, rare: { weight: 10, specific: 2, generic: 0 } } })).toThrow(/specific/);
    const { epic: _epic, ...noEpic } = catchingJson.rarities;
    expect(bad({ rarities: noEpic })).toThrow(/epic/);
    const { lake: _lake, ...noLake } = catchingJson.areas;
    expect(bad({ areas: noLake })).toThrow(/lake/);
  });
});
