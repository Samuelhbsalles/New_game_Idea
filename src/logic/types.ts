import type { Appearance } from './appearance';
import type { TimeConfig } from './gameTime';

/** Static definition of a creature species, loaded from creatures.json. */
export interface Species {
  id: string;
  name: string;
  baseProduction: number;
  maxEnergy: number;
  /** Production multiplier by shopId. A missing shop means no affinity. */
  affinities: Record<string, number>;
}

/** Static definition of a workplace (a building creatures work in), loaded from shops.json. */
export interface Shop {
  id: string;
  name: string;
  /** Work stations; one creature each. */
  slots: number;
  /** Shift length in in-game hours. */
  shiftHours: number;
  /** Shift length in real milliseconds, derived from shiftHours and the time config. */
  shiftMs: number;
  /** Item a finished shift yields, or COINS_PRODUCT for workplaces that pay coins. */
  productItemId: string;
  /** Output scale: items = baseProduction × affinity × shiftHours × rate (see work.ts). */
  rate: number;
}

/** Static definition of an item, loaded from items.json. */
export interface Item {
  id: string;
  name: string;
  price: number;
  /** Energy restored when used as food; absent for non-food items. */
  energyRestore?: number;
}

/** Starting setup for a new game, loaded from start.json. */
export interface StartConfig {
  coins: number;
  inventory: Record<string, number>;
  /** Species ids of the creatures the player starts with. */
  creatures: string[];
}

/** Read-only gameplay configuration. */
export interface Config {
  species: Species[];
  shops: Shop[];
  items: Item[];
  start: StartConfig;
  time: TimeConfig;
}

export type CreatureStatus = 'idle' | 'working' | 'resting';

/** A creature the player owns. */
export interface Creature {
  id: string;
  speciesId: string;
  energy: number;
  /** Timestamp (ms) at which `energy` was last computed. */
  energyAt: number;
  status: CreatureStatus;
}

/** A running or finished shift. Times are ms timestamps from the Clock. */
export interface Shift {
  shopId: string;
  slot: number;
  creatureId: string;
  startedAt: number;
  endsAt: number;
}

/** The whole game state: plain, JSON-serialisable data. */
export interface GameState {
  saveVersion: number;
  coins: number;
  inventory: Record<string, number>;
  creatures: Creature[];
  shifts: Shift[];
  /** Food portions waiting in the home bowl. Optional so older saves still load (missing = 0). */
  bowl?: number;
  /** The player's look from the character creator; scenes vet it against the cosmetics catalog. */
  appearance?: Appearance;
  /** Ids of cosmetics bought beyond the starter set. */
  cosmetics?: string[];
  /** Species ids caught at least once (the album). Starting creatures do not count. */
  caught?: string[];
  /** Timestamp (ms) at which in-game day 1 began. Optional so older saves load (filled in on load). */
  worldStartAt?: number;
}
