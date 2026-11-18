/**
 * The bag (user's design, 2026-11-15): a grid with tabs — baits, other items,
 * and the creatures travelling with you. Up to `partyMax` creatures come
 * along; the rest wait at home, where they can be swapped. Render-independent.
 * Data: src/data/bag.json.
 */
import type { Game } from './game';
import type { Config } from './types';

export type BagTab = 'baits' | 'items' | 'creatures';
export const BAG_TABS: BagTab[] = ['baits', 'items', 'creatures'];

export interface BagRules {
  /** Most creatures that travel with the player. */
  partyMax: number;
  /** Grid size of one tab. */
  cols: number;
  rows: number;
  /** Tab order. */
  tabs: BagTab[];
}

/** What kind of thing an item is, for the bag's tabs. */
export type ItemKind = 'bait' | 'food' | 'goods';

/** Validates bag.json. Throws naming the bad field. */
export function parseBagRules(json: unknown): BagRules {
  const o = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  const int = (k: string, min: number) => {
    const v = o[k];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < min) throw new Error(`bag.json ${k}: expected a whole number >= ${min}`);
    return v;
  };
  const tabs = o.tabs;
  if (!Array.isArray(tabs) || tabs.length === 0 || !tabs.every((t) => BAG_TABS.includes(t as BagTab))) throw new Error(`bag.json tabs: expected some of ${BAG_TABS.join(', ')}`);
  return { partyMax: int('partyMax', 1), cols: int('cols', 1), rows: int('rows', 1), tabs: tabs as BagTab[] };
}

/** Bait if some species goes for it (or it is the generic bait), food if it restores energy, else goods. */
export function itemKind(config: Config, genericBaitId: string, itemId: string): ItemKind {
  if (itemId === genericBaitId || config.species.some((s) => s.baitId === itemId)) return 'bait';
  if (config.items.find((i) => i.id === itemId)?.energyRestore !== undefined) return 'food';
  return 'goods';
}

/** Species whose favourite bait this is (for the item's description). */
export function baitFans(config: Config, itemId: string): string[] {
  return config.species.filter((s) => s.baitId === itemId).map((s) => s.id);
}

/**
 * Items held for a tab, in catalog order: baits on the baits tab, everything
 * else on the items tab. Items with none held are left out.
 */
export function tabItems(game: Game, genericBaitId: string, tab: 'baits' | 'items'): { itemId: string; count: number }[] {
  return game.config.items
    .filter((i) => (game.state.inventory[i.id] ?? 0) > 0)
    .filter((i) => (itemKind(game.config, genericBaitId, i.id) === 'bait') === (tab === 'baits'))
    .map((i) => ({ itemId: i.id, count: game.state.inventory[i.id] }));
}

/**
 * Ids of the creatures travelling with the player, at most `max`. A save
 * without a party (older saves) takes the first `max` creatures.
 */
export function partyOf(game: Game, max: number): string[] {
  const ids = new Set(game.state.creatures.map((c) => c.id));
  const chosen = game.state.party ?? game.state.creatures.map((c) => c.id);
  return chosen.filter((id) => ids.has(id)).slice(0, max);
}

/** Creatures that stay at home (not in the party). */
export function atHome(game: Game, max: number): string[] {
  const party = new Set(partyOf(game, max));
  return game.state.creatures.map((c) => c.id).filter((id) => !party.has(id));
}

/** Brings a creature along. 'full' when the party already has `max`. */
export function takeAlong(game: Game, id: string, max: number): 'ok' | 'full' | 'unknown' {
  if (!game.state.creatures.some((c) => c.id === id)) return 'unknown';
  const party = partyOf(game, max);
  if (party.includes(id)) return 'ok';
  if (party.length >= max) return 'full';
  game.state.party = [...party, id];
  return 'ok';
}

/** Leaves a creature at home. The last one can't be left: someone always comes along. */
export function leaveHome(game: Game, id: string, max: number): 'ok' | 'last' {
  const party = partyOf(game, max);
  if (!party.includes(id)) return 'ok';
  if (party.length <= 1) return 'last';
  game.state.party = party.filter((p) => p !== id);
  return 'ok';
}

/** A newly caught creature joins the party if there is room; otherwise it goes home. */
export function placeNewCreature(game: Game, id: string, max: number): 'party' | 'home' {
  return takeAlong(game, id, max) === 'ok' ? 'party' : 'home';
}

/** How a creature is doing, for the bag: from what it is doing and its energy now (not a stale status). */
export type Mood = 'working' | 'rested' | 'recovering' | 'tired';

/** Below this share of max energy a creature reads as tired. */
const TIRED_SHARE = 0.4;

/**
 * Working while on a shift; otherwise by energy: full = rested, low = tired,
 * in between = recovering. A creature back from work with full energy is rested.
 */
export function moodOf(status: 'idle' | 'working' | 'resting', energy: number, maxEnergy: number): Mood {
  if (status === 'working') return 'working';
  if (energy >= maxEnergy) return 'rested';
  return energy < maxEnergy * TIRED_SHARE ? 'tired' : 'recovering';
}
