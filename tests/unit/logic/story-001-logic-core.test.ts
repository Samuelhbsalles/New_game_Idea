import { describe, expect, it } from 'vitest';
import creatures from '../../../src/data/creatures.json';
import items from '../../../src/data/items.json';
import shops from '../../../src/data/shops.json';
import start from '../../../src/data/start.json';
import { createFakeClock } from '../../../src/logic/clock';
import { parseConfig } from '../../../src/logic/config';
import { Game } from '../../../src/logic/game';
import { LocalStorageAdapter } from '../../../src/logic/localStorageAdapter';
import { MemoryStorage } from '../../../src/logic/memoryStorage';
import { deserialize, newGame, serialize } from '../../../src/logic/state';
import type { Storage } from '../../../src/logic/storage';

// Raw source text of every logic file, bundled at test time (no runtime file I/O).
const logicSources = import.meta.glob('../../../src/logic/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const T = 1_700_000_000_000;
const rawConfig = { species: creatures, shops, items, start };

function makeGame(storage: Storage = new MemoryStorage(), clockStart = T) {
  const clock = createFakeClock(clockStart);
  const config = parseConfig(rawConfig);
  return { clock, config, storage, game: Game.load(config, clock, storage) };
}

describe('story-001 logic core', () => {
  it('AC1: no logic file imports Phaser or touches the DOM', () => {
    const files = Object.keys(logicSources);
    expect(files.length).toBeGreaterThan(0);
    for (const [file, src] of Object.entries(logicSources)) {
      expect(src, file).not.toMatch(/from\s+['"]phaser['"]/);
      expect(src, file).not.toMatch(/\b(document|window|navigator)\./);
      if (!file.endsWith('localStorageAdapter.ts')) {
        expect(src, file).not.toMatch(/\blocalStorage\b/);
      }
    }
  });

  it('AC2: creatures, shops, items, prices and shift length load from JSON', () => {
    const config = parseConfig(rawConfig);
    expect(config.species.map((s) => s.id)).toEqual(['rabbit', 'pigeon', 'cat', 'monkey']);
    expect(config.species.find((s) => s.id === 'monkey')?.affinities.bakery).toBe(4);
    expect(config.species.find((s) => s.id === 'rabbit')?.affinities).toEqual({});
    const bakery = config.shops.find((s) => s.id === 'bakery');
    expect(bakery?.slots).toBe(6);
    expect(bakery?.shiftMs).toBe(4 * 60 * 60 * 1000);
    expect(config.items.map((i) => i.id)).toEqual(expect.arrayContaining(['bread', 'bait', 'food']));
    expect(config.items.every((i) => typeof i.price === 'number')).toBe(true);

    // A game built from the config takes its numbers from it.
    const fresh = newGame(config, createFakeClock(T));
    expect(fresh.coins).toBe(start.coins);
    expect(fresh.inventory).toEqual(start.inventory);

    // Invalid config is rejected at the boundary.
    expect(() => parseConfig({ ...rawConfig, shops: [{ ...shops[0], shiftMs: -1 }] })).toThrow(/shiftMs/);
    expect(() => parseConfig({ ...rawConfig, shops: [{ ...shops[0], productItemId: 'nope' }] })).toThrow(/productItemId/);
  });

  it('AC3: time comes from the injected clock, never Date.now() in logic', () => {
    for (const [file, src] of Object.entries(logicSources)) {
      if (file.endsWith('/clock.ts')) continue;
      expect(src, file).not.toMatch(/Date\.now\s*\(/);
      expect(src, file).not.toMatch(/new Date\s*\(/);
    }
    const { game, clock } = makeGame();
    const shift = game.startShift('c1', 'bakery', 0);
    expect(shift.startedAt).toBe(T);
    clock.advance(1234);
    const second = game.startShift('c1', 'bakery', 1);
    expect(second.startedAt).toBe(T + 1234);
  });

  it('AC4: state saves and loads through the Storage interface (memory and localStorage adapters)', () => {
    const memory = new MemoryStorage();
    expect(memory.load()).toBeNull();
    memory.save('abc');
    expect(memory.load()).toBe('abc');

    const backing = new Map<string, string>();
    const fakeBackend = {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
    };
    const adapter = new LocalStorageAdapter('save', fakeBackend);
    expect(adapter.load()).toBeNull();
    const { game, config, clock } = makeGame(adapter);
    game.save();
    expect(backing.has('save')).toBe(true);
    expect(Game.load(config, clock, adapter).state).toEqual(game.state);
  });

  it('AC5: save then load round-trip returns an equal state', () => {
    const { game, config, clock, storage } = makeGame();
    game.startShift('c1', 'bakery', 2);
    game.state.coins = 77;
    game.state.inventory.bread = 3;
    game.save();
    const loaded = Game.load(config, clock, storage);
    expect(loaded.state).toEqual(game.state);
    expect(deserialize(serialize(game.state))).toEqual(game.state);
    expect(game.state.saveVersion).toBe(1);
  });

  it('AC6: a shift started at T reports complete after reload once the clock passes T + shiftMs', () => {
    const { game, config, clock, storage } = makeGame();
    const shiftMs = config.shops.find((s) => s.id === 'bakery')!.shiftMs;
    game.startShift('c1', 'bakery', 0);
    expect(game.isShiftComplete('bakery', 0)).toBe(false);
    game.save();

    // Just before the end: still running after a reload.
    clock.advance(shiftMs - 1);
    expect(Game.load(config, clock, storage).isShiftComplete('bakery', 0)).toBe(false);

    // Past the end: complete after reload.
    clock.advance(1);
    const reloaded = Game.load(config, clock, storage);
    expect(reloaded.isShiftComplete('bakery', 0)).toBe(true);
    expect(reloaded.isShiftComplete('bakery', 1)).toBe(false);
  });

  it('AC7: a missing or corrupt save starts a fresh game and never throws', () => {
    const config = parseConfig(rawConfig);
    const clock = createFakeClock(T);
    const fresh = newGame(config, clock);

    expect(Game.load(config, clock, new MemoryStorage(null)).state).toEqual(fresh);

    const corrupt = [
      '',
      '{not json',
      'null',
      '[]',
      '"text"',
      '{}',
      JSON.stringify({ ...fresh, saveVersion: 999 }),
      JSON.stringify({ ...fresh, coins: 'lots' }),
      JSON.stringify({ ...fresh, creatures: [{ id: 'c1' }] }),
      JSON.stringify({ ...fresh, shifts: [{ shopId: 'bakery' }] }),
    ];
    for (const data of corrupt) {
      expect(() => Game.load(config, clock, new MemoryStorage(data)), data).not.toThrow();
      expect(Game.load(config, clock, new MemoryStorage(data)).state, data).toEqual(fresh);
    }

    const throwing: Storage = {
      load: () => {
        throw new Error('storage unavailable');
      },
      save: () => {},
    };
    expect(Game.load(config, clock, throwing).state).toEqual(fresh);
  });
});
