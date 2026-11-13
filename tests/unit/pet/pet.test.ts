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
import {
  AUTO_ACTIVITIES,
  followTarget,
  nextActivity,
  pickDuration,
  pickWanderTarget,
  playerPlan,
  type PetTuning,
} from '../../../src/logic/petBrain';
import { deserialize, serialize } from '../../../src/logic/state';

/** Rng that replays a fixed sequence, then repeats its last value. */
function seq(...values: number[]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

function tuning(): PetTuning {
  return {
    durations: {
      idle: [1000, 2000],
      wander: [3000, 3000],
      eat: [4000, 4000],
      sleep: [5000, 5000],
      lounge: [6000, 6000],
      askPet: [7000, 7000],
      petted: [800, 800],
    },
    weights: { idle: 1, wander: 1, eat: 1, sleep: 1, lounge: 1, askPet: 1 },
  };
}

function makeGame() {
  const clock = createFakeClock(1_000);
  const config = parseConfig({ species: creatures, shops, items, start, time });
  return { clock, game: Game.create(config, clock, new MemoryStorage()) };
}

describe('pet brain', () => {
  it('picks a duration inside the range', () => {
    expect(pickDuration([1000, 2000], () => 0)).toBe(1000);
    expect(pickDuration([1000, 2000], () => 0.5)).toBe(1500);
  });

  it('picks activities by weight, in AUTO_ACTIVITIES order', () => {
    // Six equal weights: roll r*6 lands in slot floor(r*6).
    AUTO_ACTIVITIES.forEach((a, i) => {
      expect(nextActivity(tuning(), seq((i + 0.5) / 6, 0)).activity).toBe(a);
    });
  });

  it('never repeats the previous activity when another is possible', () => {
    for (let r = 0; r < 1; r += 0.05) {
      expect(nextActivity(tuning(), seq(r, 0), 'idle').activity).not.toBe('idle');
    }
  });

  it('can do every self-chosen activity, so it does not repeat the same thing forever', () => {
    const seen = new Set<string>();
    let prev: string | undefined;
    for (let r = 0; r < 1; r += 0.01) {
      const a = nextActivity(tuning(), seq(r, 0), prev as never).activity;
      seen.add(a);
      prev = a;
    }
    expect([...seen].sort()).toEqual([...AUTO_ACTIVITIES].sort());
  });

  it('skips activities the room does not allow (empty bowl, no sofa)', () => {
    const allowed = (a: string) => a !== 'eat' && a !== 'lounge';
    for (let r = 0; r < 1; r += 0.05) {
      const a = nextActivity(tuning(), seq(r, 0), undefined, allowed).activity;
      expect(['eat', 'lounge']).not.toContain(a);
    }
  });

  it('falls back to idle when nothing is allowed', () => {
    expect(nextActivity(tuning(), seq(0.5, 0), undefined, () => false).activity).toBe('idle');
  });

  it('player actions use their configured duration; follow lasts until stopped', () => {
    expect(playerPlan(tuning(), 'petted', () => 0)).toEqual({ activity: 'petted', durationMs: 800 });
    expect(playerPlan(tuning(), 'follow', () => 0).durationMs).toBe(Infinity);
  });

  it('a follower walks to `distance` px short of the leader, and stops when close', () => {
    expect(followTarget({ x: 0, y: 0 }, { x: 100, y: 0 }, 20)).toEqual({ x: 80, y: 0 });
    expect(followTarget({ x: 0, y: 0 }, { x: 10, y: 0 }, 20)).toBeNull();
  });

  it('wander targets land on free floor tile centres only', () => {
    const floor = [
      [false, false, false],
      [false, true, true],
      [false, false, false],
    ];
    const blocked = [{ x: 32, y: 32, w: 32, h: 32 }]; // covers tile (1,1)
    expect(pickWanderTarget(floor, 32, blocked, () => 0)).toEqual({ x: 80, y: 48 });
    expect(pickWanderTarget(floor, 32, [{ x: 0, y: 0, w: 96, h: 96 }], () => 0)).toBeNull();
  });
});

describe('feeding, bowl and resting', () => {
  it('feeding uses one food and restores energy up to max', () => {
    const { game } = makeGame();
    const c = game.state.creatures[0];
    c.energy = 50;
    const before = game.state.inventory.food;
    expect(game.feed(c.id, 'food')).toEqual({ ok: true, energy: 80 });
    expect(game.state.inventory.food).toBe(before - 1);
    c.energy = 90;
    expect(game.feed(c.id, 'food')).toEqual({ ok: true, energy: 100 });
  });

  it('feeding without food reports no_item and changes nothing', () => {
    const { game } = makeGame();
    const c = game.state.creatures[0];
    game.state.inventory.food = 0;
    c.energy = 10;
    expect(game.feed(c.id, 'food')).toEqual({ ok: false, reason: 'no_item' });
    expect(c.energy).toBe(10);
  });

  it('feeding a non-food item reports not_food', () => {
    const { game } = makeGame();
    expect(game.feed(game.state.creatures[0].id, 'bait')).toEqual({ ok: false, reason: 'not_food' });
  });

  it('filling the bowl moves food from the inventory, up to capacity', () => {
    const { game } = makeGame();
    game.state.inventory.food = 5;
    expect(game.fillBowl('food', 2)).toEqual({ ok: true, bowl: 1 });
    expect(game.fillBowl('food', 2)).toEqual({ ok: true, bowl: 2 });
    expect(game.fillBowl('food', 2)).toEqual({ ok: false, reason: 'full' });
    expect(game.state.inventory.food).toBe(3);
  });

  it('filling the bowl with no food or a non-food item fails', () => {
    const { game } = makeGame();
    game.state.inventory.food = 0;
    expect(game.fillBowl('food', 3)).toEqual({ ok: false, reason: 'no_item' });
    expect(game.fillBowl('bait', 3)).toEqual({ ok: false, reason: 'not_food' });
  });

  it('eating from the bowl uses a portion and restores energy; an empty bowl gives nothing', () => {
    const { game } = makeGame();
    const c = game.state.creatures[0];
    c.energy = 20;
    game.state.bowl = 1;
    expect(game.eatFromBowl(c.id, 'food')).toEqual({ energy: 50 });
    expect(game.state.bowl).toBe(0);
    expect(game.eatFromBowl(c.id, 'food')).toBeNull();
    expect(c.energy).toBe(50);
  });

  it('the bowl survives a save round-trip, and saves without a bowl still load', () => {
    const { game } = makeGame();
    game.state.bowl = 2;
    expect(deserialize(serialize(game.state))?.bowl).toBe(2);
    const old = { ...game.state };
    delete old.bowl;
    expect(deserialize(serialize(old))).not.toBeNull();
    expect(deserialize(serialize({ ...game.state, bowl: -1 }))).toBeNull();
  });

  it('resting sets the status', () => {
    const { game } = makeGame();
    const c = game.state.creatures[0];
    game.rest(c.id);
    expect(c.status).toBe('resting');
  });
});
