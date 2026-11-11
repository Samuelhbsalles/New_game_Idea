import { describe, expect, it } from 'vitest';
import creatures from '../../../src/data/creatures.json';
import items from '../../../src/data/items.json';
import shops from '../../../src/data/shops.json';
import start from '../../../src/data/start.json';
import { createFakeClock } from '../../../src/logic/clock';
import { parseConfig } from '../../../src/logic/config';
import { Game } from '../../../src/logic/game';
import { MemoryStorage } from '../../../src/logic/memoryStorage';
import { nextActivity, pickDuration, pickWanderTarget, playerPlan, type PetTuning } from '../../../src/logic/petBrain';

/** Rng that replays a fixed sequence, then repeats its last value. */
function seq(...values: number[]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

function tuning(): PetTuning {
  return {
    durations: { idle: [1000, 2000], wander: [3000, 3000], eat: [4000, 4000], sleep: [5000, 5000], petted: [800, 800] },
    weights: { idle: 1, wander: 1, eat: 1, sleep: 1 },
  };
}

function makeGame() {
  const clock = createFakeClock(1_000);
  const config = parseConfig({ species: creatures, shops, items, start });
  return { clock, game: Game.create(config, clock, new MemoryStorage()) };
}

describe('pet brain', () => {
  it('picks a duration inside the range', () => {
    expect(pickDuration([1000, 2000], () => 0)).toBe(1000);
    expect(pickDuration([1000, 2000], () => 0.5)).toBe(1500);
  });

  it('picks activities by weight', () => {
    // Pool idle,wander,eat,sleep with equal weight: roll 0.6*4 = 2.4 lands in 'eat'.
    expect(nextActivity(tuning(), seq(0.6, 0)).activity).toBe('eat');
    expect(nextActivity(tuning(), seq(0.0, 0)).activity).toBe('idle');
    expect(nextActivity(tuning(), seq(0.99, 0)).activity).toBe('sleep');
  });

  it('never repeats the previous activity when another is possible', () => {
    for (let r = 0; r < 1; r += 0.05) {
      expect(nextActivity(tuning(), seq(r, 0), 'idle').activity).not.toBe('idle');
    }
  });

  it('ignores zero-weight activities', () => {
    const t = tuning();
    t.weights = { idle: 0, wander: 1, eat: 0, sleep: 0 };
    expect(nextActivity(t, seq(0.9, 0)).activity).toBe('wander');
  });

  it('player actions use their configured duration', () => {
    expect(playerPlan(tuning(), 'petted', () => 0)).toEqual({ activity: 'petted', durationMs: 800 });
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

describe('feeding and resting', () => {
  it('feeding uses one food and restores energy up to max', () => {
    const { game } = makeGame();
    const c = game.state.creatures[0];
    c.energy = 50;
    const before = game.state.inventory.food;
    const r = game.feed(c.id, 'food');
    expect(r).toEqual({ ok: true, energy: 80 });
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

  it('resting sets the status', () => {
    const { game } = makeGame();
    const c = game.state.creatures[0];
    game.rest(c.id);
    expect(c.status).toBe('resting');
  });
});
