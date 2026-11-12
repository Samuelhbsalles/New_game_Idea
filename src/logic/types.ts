/** Static definition of a creature species, loaded from creatures.json. */
export interface Species {
  id: string;
  name: string;
  baseProduction: number;
  maxEnergy: number;
  /** Production multiplier by shopId. A missing shop means no affinity. */
  affinities: Record<string, number>;
}

/** Static definition of a shop, loaded from shops.json. */
export interface Shop {
  id: string;
  name: string;
  slots: number;
  /** Shift length in milliseconds. */
  shiftMs: number;
  productItemId: string;
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
}
