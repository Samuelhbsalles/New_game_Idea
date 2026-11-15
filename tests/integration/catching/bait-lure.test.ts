import { describe, expect, it } from 'vitest';
import catchingJson from '../../../src/data/catching.json';
import creatures from '../../../src/data/creatures.json';
import items from '../../../src/data/items.json';
import shops from '../../../src/data/shops.json';
import start from '../../../src/data/start.json';
import time from '../../../src/data/time.json';
import { acceptsBait, baitsHeld, catchCreature, parseCatchRules, returnBait, takeBait } from '../../../src/logic/catching';
import { createFakeClock } from '../../../src/logic/clock';
import { parseConfig } from '../../../src/logic/config';
import { Game } from '../../../src/logic/game';
import { MemoryStorage } from '../../../src/logic/memoryStorage';

const T = 1_700_000_000_000;
const config = parseConfig({ species: creatures, shops, items, start, time });
const rules = parseCatchRules(catchingJson, config.species, items.map((i) => i.id));
const sp = (id: string) => config.species.find((s) => s.id === id)!;

/** A fresh game holding exactly these items. */
function fresh(inventory: Record<string, number>) {
  const game = Game.create(config, createFakeClock(T), new MemoryStorage());
  game.state.inventory = { ...inventory };
  return game;
}

describe('catching with bait on the ground', () => {
  it('a species goes for its own bait, and for the generic bait only if its rarity allows', () => {
    const game = fresh({});
    const squirrel = sp('squirrel');
    expect(acceptsBait(game, rules, 'squirrel', squirrel.baitId)).toBe('specific');
    const genericOk = rules.rarities[squirrel.rarity].generic > 0;
    expect(acceptsBait(game, rules, 'squirrel', rules.genericBaitId)).toBe(genericOk ? 'generic' : null);
    // Somebody else's favourite does nothing for it.
    const other = config.species.find((s) => s.baitId !== squirrel.baitId)!;
    expect(acceptsBait(game, rules, 'squirrel', other.baitId)).toBeNull();
  });

  it('a legendary cannot be lured with bait (its acquisition rule is still to be decided)', () => {
    const game = fresh({});
    expect(acceptsBait(game, rules, 'pug', sp('pug').baitId)).toBeNull();
  });

  it('lists only the baits the player holds', () => {
    const game = fresh({ bait: 2, nuts: 1, bread: 0, coffee: 5 }); // coffee is nobody's bait
    expect(baitsHeld(game, rules).sort((a, b) => a.itemId.localeCompare(b.itemId))).toEqual([
      { itemId: 'bait', count: 2 },
      { itemId: 'nuts', count: 1 },
    ]);
  });

  it('putting bait down takes one; picking it back up returns it', () => {
    const game = fresh({ nuts: 1 });
    expect(takeBait(game, 'nuts')).toBe(true);
    expect(game.state.inventory.nuts).toBe(0);
    expect(takeBait(game, 'nuts')).toBe(false);
    returnBait(game, 'nuts');
    expect(game.state.inventory.nuts).toBe(1);
  });

  it('a won catch adds the creature once and records the album the first time only', () => {
    const game = fresh({});
    const before = game.state.creatures.length;
    const a = catchCreature(game, 'squirrel');
    const b = catchCreature(game, 'squirrel');
    expect(game.state.creatures.length).toBe(before + 2);
    expect(a.firstOfSpecies).toBe(true);
    expect(b.firstOfSpecies).toBe(false);
    expect(a.creature.id).not.toBe(b.creature.id);
    expect(a.creature.status).toBe('idle');
  });
});
