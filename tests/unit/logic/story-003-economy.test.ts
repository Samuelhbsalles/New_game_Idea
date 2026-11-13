import { describe, expect, it } from 'vitest';
import creatures from '../../../src/data/creatures.json';
import items from '../../../src/data/items.json';
import shops from '../../../src/data/shops.json';
import start from '../../../src/data/start.json';
import time from '../../../src/data/time.json';
import { createFakeClock } from '../../../src/logic/clock';
import { parseConfig } from '../../../src/logic/config';
import { Game } from '../../../src/logic/game';
import { MemoryStorage } from '../../../src/logic/memoryStorage';

const config = parseConfig({ species: creatures, shops, items, start, time });
const price = (id: string) => items.find((i) => i.id === id)!.price;

function fresh(coins: number, inventory: Record<string, number>, storage = new MemoryStorage()) {
  const game = Game.create(config, createFakeClock(0), storage);
  game.state.coins = coins;
  game.state.inventory = { ...inventory };
  return game;
}

describe('story-003 economy: sell and buy at the market', () => {
  it('AC1: goods sell at the JSON price; coins rise by price × quantity', () => {
    const game = fresh(0, { bread: 5 });
    expect(game.sell('bread', 3)).toEqual({ ok: true, coins: price('bread') * 3, count: 2 });
  });

  it('AC2: you cannot sell more than you hold, nor things the market does not buy', () => {
    const game = fresh(0, { bread: 1, bait: 4 });
    expect(game.sell('bread', 2)).toEqual({ ok: false, reason: 'not_enough' });
    expect(game.sell('bait', 1)).toEqual({ ok: false, reason: 'not_bought' });
    expect(game.state).toMatchObject({ coins: 0, inventory: { bread: 1, bait: 4 } });
  });

  it('AC3: baits and food can be bought at the JSON price only when coins cover it', () => {
    const game = fresh(price('fish'), {});
    expect(game.buy('fish')).toEqual({ ok: true, coins: 0, count: 1 });
    expect(game.buy('fish')).toEqual({ ok: false, reason: 'no_coins' });
    expect(fresh(100, {}).buy('food', 2)).toEqual({ ok: true, coins: 100 - price('food') * 2, count: 2 });
  });

  it('AC4: coins never go negative and a failed purchase changes nothing', () => {
    const game = fresh(5, { fish: 1 });
    expect(game.buy('algae', 1)).toEqual({ ok: false, reason: 'no_coins' });
    expect(game.buy('bread', 1)).toEqual({ ok: false, reason: 'not_sold' });
    expect(game.buy('fish', 0)).toEqual({ ok: false, reason: 'bad_qty' });
    expect(game.state).toMatchObject({ coins: 5, inventory: { fish: 1 } });
  });

  it('AC5: coins and inventory survive save/load', () => {
    const storage = new MemoryStorage();
    const game = fresh(50, { bread: 4 }, storage);
    game.sell('bread', 4);
    game.buy('nuts', 2);
    game.save();
    const loaded = Game.load(config, createFakeClock(0), storage);
    expect(loaded.state.coins).toBe(game.state.coins);
    expect(loaded.state.inventory).toEqual(game.state.inventory);
  });

  it('every species bait can be got somewhere: bought at the market or made at a workplace', () => {
    const made = new Set(config.shops.map((s) => s.productItemId));
    for (const s of config.species) {
      const bait = config.items.find((i) => i.id === s.baitId)!;
      expect(bait.buyable || made.has(bait.id), `${s.id} bait ${bait.id}`).toBe(true);
    }
  });
});
