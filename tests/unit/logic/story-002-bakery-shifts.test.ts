import { describe, expect, it } from 'vitest';
import creatures from '../../../src/data/creatures.json';
import items from '../../../src/data/items.json';
import shops from '../../../src/data/shops.json';
import start from '../../../src/data/start.json';
import time from '../../../src/data/time.json';
import { createFakeClock } from '../../../src/logic/clock';
import { parseConfig } from '../../../src/logic/config';
import { Game } from '../../../src/logic/game';
import { gameTimeAt, parseTimeConfig } from '../../../src/logic/gameTime';
import { MemoryStorage } from '../../../src/logic/memoryStorage';
import { COINS_PRODUCT, shiftOutput } from '../../../src/logic/work';

const T = 1_700_000_000_000;
const config = parseConfig({ species: creatures, shops, items, start, time });

/** A game with one creature of each given species (ids c1, c2, ...). */
function gameWith(species: string[]) {
  const clock = createFakeClock(T);
  const storage = new MemoryStorage();
  const game = Game.create({ ...config, start: { ...config.start, creatures: species } }, clock, storage);
  return { game, clock, storage };
}

const bakery = config.shops.find((s) => s.id === 'bakery')!;
const sp = (id: string) => config.species.find((s) => s.id === id)!;

describe('story-002 shifts (all workplaces)', () => {
  it('AC1: a creature takes a free slot only; slots come from JSON; a working creature cannot take a second', () => {
    // Arrange
    const { game } = gameWith(['rabbit', 'monkey']);
    // Act / Assert
    expect(game.startShift('c1', 'bakery', bakery.slots).ok).toBe(false);
    expect(game.startShift('c1', 'bakery', -1)).toEqual({ ok: false, reason: 'bad_slot' });
    expect(game.startShift('c1', 'bakery', 0).ok).toBe(true);
    expect(game.startShift('c2', 'bakery', 0)).toEqual({ ok: false, reason: 'slot_taken' });
    expect(game.startShift('c1', 'factory', 0)).toEqual({ ok: false, reason: 'busy' });
    expect(game.startShift('c2', 'bakery', 1).ok).toBe(true);
    expect(game.creature('c1').status).toBe('working');
  });

  it('AC2: a shift lasts shiftHours of game time and completes across a reload', () => {
    // Arrange
    const { game, clock, storage } = gameWith(['rabbit']);
    game.startShift('c1', 'bakery', 0);
    game.save();
    // Act / Assert (the clock is shared, so check each moment before moving on)
    expect(bakery.shiftMs).toBe((bakery.shiftHours * time.dayMs) / 24);
    clock.advance(bakery.shiftMs - 1);
    const before = Game.load(game.config, clock, storage);
    expect(before.isShiftComplete('bakery', 0)).toBe(false);
    expect(before.shiftTimeLeft('bakery', 0)).toBe(1);
    clock.advance(1);
    const after = Game.load(game.config, clock, storage);
    expect(after.isShiftComplete('bakery', 0)).toBe(true);
    expect(after.shiftTimeLeft('bakery', 0)).toBe(0);
  });

  it('AC3: output = base × affinity × hours × rate; the monkey bakes 4x the generalist rabbit', () => {
    const rabbit = shiftOutput(sp('rabbit'), bakery);
    const monkey = shiftOutput(sp('monkey'), bakery);
    expect(rabbit).toBe(Math.round(sp('rabbit').baseProduction * bakery.shiftHours * bakery.rate));
    expect(monkey).toBe(rabbit * 4);
  });

  it('AC5: collecting a finished shift adds the product, frees the slot and sends the creature home tired', () => {
    // Arrange
    const { game, clock } = gameWith(['monkey']);
    game.startShift('c1', 'bakery', 2);
    clock.advance(bakery.shiftMs);
    // Act
    const r = game.collectShift('bakery', 2);
    // Assert
    expect(r).toEqual({ ok: true, itemId: 'bread', count: shiftOutput(sp('monkey'), bakery), creatureId: 'c1' });
    expect(game.state.inventory.bread).toBe(shiftOutput(sp('monkey'), bakery));
    expect(game.shiftAt('bakery', 2)).toBeUndefined();
    expect(game.creature('c1').status).toBe('resting');
    expect(game.startShift('c1', 'factory', 0).ok).toBe(true);
  });

  it('AC6: collecting early gives nothing and leaves the shift running; an empty slot gives nothing', () => {
    // Arrange
    const { game, clock } = gameWith(['rabbit']);
    game.startShift('c1', 'construction', 0);
    clock.advance(bakery.shiftMs - 1);
    // Act
    const early = game.collectShift('construction', 0);
    // Assert
    expect(early).toEqual({ ok: false, reason: 'not_done' });
    expect(game.state.inventory.stone).toBeUndefined();
    expect(game.shiftAt('construction', 0)).toBeDefined();
    expect(game.collectShift('construction', 1)).toEqual({ ok: false, reason: 'empty' });
  });

  it('a coin-paying workplace (hotel) adds coins, not an item', () => {
    // Arrange
    const { game, clock } = gameWith(['cat']);
    const hotel = config.shops.find((s) => s.id === 'hotel')!;
    const coinsBefore = game.state.coins;
    game.startShift('c1', 'hotel', 0);
    clock.advance(hotel.shiftMs);
    // Act
    const r = game.collectShift('hotel', 0);
    // Assert
    const paid = shiftOutput(sp('cat'), hotel);
    expect(r).toEqual({ ok: true, itemId: COINS_PRODUCT, count: paid, creatureId: 'c1' });
    expect(game.state.coins).toBe(coinsBefore + paid);
    expect(game.state.inventory[COINS_PRODUCT]).toBeUndefined();
    expect(game.productCount('hotel')).toBe(coinsBefore + paid);
  });

  it('"coins" cannot also be an item id', () => {
    expect(() => parseConfig({ species: creatures, shops, items: [...items, { id: 'coins', name: 'Coins', price: 1 }], start, time })).toThrow(/reserved/);
  });

  it('each workplace yields its own material, and species affinities differ per job', () => {
    const factory = config.shops.find((s) => s.id === 'factory')!;
    const construction = config.shops.find((s) => s.id === 'construction')!;
    expect(factory.productItemId).toBe('planks');
    expect(construction.productItemId).toBe('stone');
    expect(shiftOutput(sp('rabbit'), construction)).toBeGreaterThan(shiftOutput(sp('rabbit'), factory));
    expect(shiftOutput(sp('monkey'), factory)).toBeGreaterThan(shiftOutput(sp('monkey'), construction));
  });
});

describe('game clock', () => {
  const cfg = parseTimeConfig({ dayMs: 2400, startHour: 6, nightStartHour: 18, dayStartHour: 6 });

  it('starts day 1 at startHour', () => {
    expect(gameTimeAt(0, 0, cfg)).toEqual({ day: 1, hour: 6, minute: 0 });
  });

  it('advances one game hour per dayMs / 24', () => {
    expect(gameTimeAt(100, 0, cfg)).toEqual({ day: 1, hour: 7, minute: 0 });
  });

  it('rolls into day 2 at midnight and again a full day after the start', () => {
    expect(gameTimeAt(18 * 100, 0, cfg)).toEqual({ day: 2, hour: 0, minute: 0 });
    expect(gameTimeAt(2400, 0, cfg)).toEqual({ day: 2, hour: 6, minute: 0 });
  });

  it('a new save starts its world at creation; an old save without it starts on load', () => {
    const { game } = gameWith(['rabbit']);
    expect(game.state.worldStartAt).toBe(T);
    const clock = createFakeClock(T + 5);
    const old = Game.load(config, clock, new MemoryStorage(JSON.stringify({ ...game.state, worldStartAt: undefined })));
    expect(old.state.worldStartAt).toBe(T + 5);
    expect(old.gameTime()).toEqual({ day: 1, hour: time.startHour, minute: 0 });
  });

  it('rejects a bad time config', () => {
    expect(() => parseTimeConfig({ dayMs: 0, startHour: 6, nightStartHour: 18, dayStartHour: 6 })).toThrow(/dayMs/);
    expect(() => parseTimeConfig({ dayMs: 2400, startHour: 24, nightStartHour: 18, dayStartHour: 6 })).toThrow(/startHour/);
  });
});
