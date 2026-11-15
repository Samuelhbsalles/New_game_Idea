import { describe, expect, it } from 'vitest';
import furnitureJson from '../../../src/data/furniture.json';
import { buyFurniture, shopFurniture } from '../../../src/logic/furnitureShop';
import type { HomeLayout } from '../../../src/logic/home';
import { parseCatalog, type FurnitureItem } from '../../../src/logic/room';

/** A catalog with one piece the shop sells and one it doesn't. */
const CATALOG: FurnitureItem[] = [
  { id: 'lamp', sprite: 'l', w: 16, h: 32, solid: true, price: 40, shop: true },
  { id: 'bed', sprite: 'b', w: 60, h: 80, solid: true, price: 120 },
];
const STARTER = [{ item: 'bed', x: 50, y: 50 }];

describe('furniture shop', () => {
  it('the shipped catalog parses and the shop has the 16 approved pieces', () => {
    const cat = parseCatalog(furnitureJson);
    expect(shopFurniture(cat)).toHaveLength(16);
  });

  it('lists only pieces marked for the shop', () => {
    expect(shopFurniture(CATALOG).map((f) => f.id)).toEqual(['lamp']);
  });

  it('buying takes the price and packs the piece away in the home storage', () => {
    // Arrange: a player who never opened their home yet (no layout saved)
    const state: { coins: number; home?: HomeLayout } = { coins: 100 };
    // Act
    const r = buyFurniture(state, CATALOG, STARTER, 'lamp');
    // Assert
    expect(r).toEqual({ ok: true, coins: 60 });
    expect(state.home?.stored).toEqual({ lamp: 1 });
    expect(state.home?.placements).toEqual(STARTER); // the starter room is kept
  });

  it('a second one stacks in storage', () => {
    const state: { coins: number; home?: HomeLayout } = { coins: 100, home: { placements: [], stored: { lamp: 1 } } };
    buyFurniture(state, CATALOG, STARTER, 'lamp');
    expect(state.home?.stored.lamp).toBe(2);
  });

  it('refuses without enough coins, or a piece the shop does not sell, charging nothing', () => {
    const state: { coins: number; home?: HomeLayout } = { coins: 39 };
    expect(buyFurniture(state, CATALOG, STARTER, 'lamp')).toEqual({ ok: false, reason: 'no_coins' });
    expect(buyFurniture(state, CATALOG, STARTER, 'bed')).toEqual({ ok: false, reason: 'not_sold' });
    expect(buyFurniture(state, CATALOG, STARTER, 'ufo')).toEqual({ ok: false, reason: 'not_sold' });
    expect(state).toEqual({ coins: 39 });
  });
});
