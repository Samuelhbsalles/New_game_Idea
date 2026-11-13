import type { Appearance } from './appearance';
import type { TimeConfig } from './gameTime';

/** Rarity tiers (design/creatures.md): how often a species appears and how it is caught. */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

/** When in the day a species is out. */
export type TimeOfDay = 'any' | 'day' | 'night';
export const TIMES_OF_DAY: TimeOfDay[] = ['any', 'day', 'night'];

/** Weather a species needs ('any' = whatever the weather). */
export type WeatherNeed = 'any' | 'cold' | 'rain' | 'storm' | 'lowTide' | 'tideEvent';
export const WEATHER_NEEDS: WeatherNeed[] = ['any', 'cold', 'rain', 'storm', 'lowTide', 'tideEvent'];

/** Static definition of a creature species, loaded from creatures.json (design/creatures.md). */
export interface Species {
  id: string;
  name: string;
  rarity: Rarity;
  /** Neighbourhoods it appears in (ids from catching.json areas). */
  areas: string[];
  time: TimeOfDay;
  weather: WeatherNeed;
  baseProduction: number;
  maxEnergy: number;
  /** Energy a shift costs (story-004; placeholder). */
  energyCost: number;
  /** Preferred food item id, or null while undecided. */
  food: string | null;
  /** Item that lures it (see catching rules for how rarity uses it). */
  baitId: string;
  /** Production multiplier by shopId: above 1 a strength, below 1 a weakness. Missing = 1. */
  affinities: Record<string, number>;
  /** The reference generalist: allowed to have no strength and no weakness. */
  generalist: boolean;
  /** Why the affinities make sense (design note). */
  reason: string;
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
  /** The market sells it to the player. */
  buyable: boolean;
  /** The market buys it from the player. */
  sellable: boolean;
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
