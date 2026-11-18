import { describe, expect, it } from 'vitest';
import bagJson from '../../../src/data/bag.json';
import catchingJson from '../../../src/data/catching.json';
import creatures from '../../../src/data/creatures.json';
import items from '../../../src/data/items.json';
import shops from '../../../src/data/shops.json';
import start from '../../../src/data/start.json';
import time from '../../../src/data/time.json';
import { atHome, baitFans, itemKind, leaveHome, moodOf, parseBagRules, partyOf, placeNewCreature, tabItems, takeAlong } from '../../../src/logic/bag';
import { catchCreature } from '../../../src/logic/catching';
import { createFakeClock } from '../../../src/logic/clock';
import { parseConfig } from '../../../src/logic/config';
import { Game } from '../../../src/logic/game';
import { MemoryStorage } from '../../../src/logic/memoryStorage';
import { deserialize, serialize } from '../../../src/logic/state';

const config = parseConfig({ species: creatures, shops, items, start, time });
const GENERIC = catchingJson.genericBaitId;
/** Party size used by the tests (small, so "full" is easy to reach). */
const MAX = 2;

/** A fresh game with `n` extra caught squirrels and exactly these items. */
function fresh(n = 0, inventory: Record<string, number> = {}) {
  const game = Game.create(config, createFakeClock(1_700_000_000_000), new MemoryStorage());
  game.state.inventory = { ...inventory };
  for (let i = 0; i < n; i++) catchCreature(game, 'squirrel');
  return game;
}

describe('bag', () => {
  it('the shipped bag.json is valid: 6 creatures along, a 6x3 grid', () => {
    expect(parseBagRules(bagJson)).toEqual({ partyMax: 6, cols: 6, rows: 3, tabs: ['baits', 'items', 'creatures'] });
  });

  it('sorts items into bait, food and goods', () => {
    expect(itemKind(config, GENERIC, 'nuts')).toBe('bait');
    expect(itemKind(config, GENERIC, GENERIC)).toBe('bait');
    expect(itemKind(config, GENERIC, 'coffee')).toBe('goods');
    const food = config.items.find((i) => i.energyRestore !== undefined && !config.species.some((s) => s.baitId === i.id) && i.id !== GENERIC);
    if (food) expect(itemKind(config, GENERIC, food.id)).toBe('food');
  });

  it('names who loves a bait', () => {
    expect(baitFans(config, 'nuts')).toContain('squirrel');
  });

  it('the baits tab holds only baits held; the items tab the rest', () => {
    const game = fresh(0, { nuts: 2, coffee: 1, bread: 0 });
    expect(tabItems(game, GENERIC, 'baits')).toEqual([{ itemId: 'nuts', count: 2 }]);
    expect(tabItems(game, GENERIC, 'items')).toEqual([{ itemId: 'coffee', count: 1 }]);
  });

  it('an old save without a party brings the first few creatures', () => {
    const game = fresh(3);
    const all = game.state.creatures.map((c) => c.id);
    expect(partyOf(game, MAX)).toEqual(all.slice(0, MAX));
    expect(atHome(game, MAX)).toEqual(all.slice(MAX));
  });

  it('a new catch joins the party while there is room, then goes home', () => {
    const game = fresh(0);
    game.state.party = [game.state.creatures[0].id];
    const a = catchCreature(game, 'squirrel').creature.id;
    expect(placeNewCreature(game, a, MAX)).toBe('party');
    const b = catchCreature(game, 'squirrel').creature.id;
    expect(placeNewCreature(game, b, MAX)).toBe('home');
    expect(atHome(game, MAX)).toContain(b);
  });

  it('swapping at home: leave one, take another; the last one always stays with you', () => {
    const game = fresh(2);
    const [x, y, z] = game.state.creatures.map((c) => c.id);
    game.state.party = [x, y];
    expect(takeAlong(game, z, MAX)).toBe('full');
    expect(leaveHome(game, y, MAX)).toBe('ok');
    expect(takeAlong(game, z, MAX)).toBe('ok');
    expect(partyOf(game, MAX)).toEqual([x, z]);
    game.state.party = [x];
    expect(leaveHome(game, x, MAX)).toBe('last');
  });

  it('the party survives saving and loading', () => {
    const game = fresh(1);
    game.state.party = [game.state.creatures[1].id];
    const back = deserialize(serialize(game.state));
    expect(back?.party).toEqual(game.state.party);
  });

  it('mood comes from energy now: full energy is rested even right after work', () => {
    expect(moodOf('resting', 100, 100)).toBe('rested');
    expect(moodOf('working', 100, 100)).toBe('working');
    expect(moodOf('idle', 60, 100)).toBe('recovering');
    expect(moodOf('resting', 39, 100)).toBe('tired');
  });
});
