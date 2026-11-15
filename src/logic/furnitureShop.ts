/**
 * The furniture counter at the market: buy a piece with coins and it is packed
 * away in your apartment's storage, ready to place in decorate mode.
 * Catalog: src/data/furniture.json (pieces with "shop": true). Render-independent.
 */
import { defaultLayout, store, type HomeLayout, type Placement } from './home';
import type { FurnitureItem } from './room';

export type FurnitureBuy = { ok: true; coins: number } | { ok: false; reason: 'not_sold' | 'no_coins' };

/** The pieces the market sells, in catalog order. */
export function shopFurniture(catalog: FurnitureItem[]): FurnitureItem[] {
  return catalog.filter((f) => f.shop);
}

/**
 * Buys one `id`: takes its price and adds it to the home storage (creating the
 * home from the starter layout if the player never saved one). Nothing changes
 * when it can't be bought.
 */
export function buyFurniture(state: { coins: number; home?: HomeLayout }, catalog: FurnitureItem[], starter: Placement[], id: string): FurnitureBuy {
  const item = catalog.find((f) => f.id === id);
  if (!item || !item.shop) return { ok: false, reason: 'not_sold' };
  if (state.coins < item.price) return { ok: false, reason: 'no_coins' };
  state.coins -= item.price;
  state.home = store(state.home ?? defaultLayout(starter), id);
  return { ok: true, coins: state.coins };
}
