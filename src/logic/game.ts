import type { Clock } from './clock';
import { deserialize, isShiftDone, newGame, serialize } from './state';
import type { Storage } from './storage';
import { gameTimeAt, type GameTime } from './gameTime';
import type { Config, GameState, Shift, Shop } from './types';
import { COINS_PRODUCT, shiftOutput } from './work';

/**
 * Holds state, config, clock and storage, all injected.
 * @example
 * const game = Game.load(config, systemClock, storage); // any Storage adapter
 * game.startShift('c1', 'bakery', 0);
 * game.save();
 */
export class Game {
  constructor(
    readonly config: Config,
    readonly clock: Clock,
    readonly storage: Storage,
    public state: GameState,
  ) {}

  /** Starts a fresh game, ignoring any save. */
  static create(config: Config, clock: Clock, storage: Storage): Game {
    return new Game(config, clock, storage, newGame(config, clock));
  }

  /** Loads the save; a missing, unreadable or corrupt save starts a fresh game. Never throws. */
  static load(config: Config, clock: Clock, storage: Storage): Game {
    let data: string | null = null;
    try {
      data = storage.load();
    } catch {
      data = null;
    }
    const state = deserialize(data) ?? newGame(config, clock);
    // Saves from before the game clock existed start their day 1 now.
    state.worldStartAt ??= clock.now();
    return new Game(config, clock, storage, state);
  }

  /** Writes the current state through the Storage. */
  save(): void {
    this.storage.save(serialize(this.state));
  }

  /**
   * Puts a creature to work in a shop slot: startedAt = clock.now(),
   * endsAt = startedAt + the shop's shiftMs. Refuses (without changing anything)
   * a slot outside the shop's range, a taken slot, or a creature already working.
   * Throws on an unknown creature or shop (a bug, not a player action).
   */
  startShift(creatureId: string, shopId: string, slot: number): { ok: true; shift: Shift } | { ok: false; reason: 'bad_slot' | 'slot_taken' | 'busy' } {
    const creature = this.creature(creatureId);
    const shop = this.shop(shopId);
    if (!Number.isInteger(slot) || slot < 0 || slot >= shop.slots) return { ok: false, reason: 'bad_slot' };
    if (this.shiftAt(shopId, slot)) return { ok: false, reason: 'slot_taken' };
    if (creature.status === 'working' || this.state.shifts.some((s) => s.creatureId === creatureId)) return { ok: false, reason: 'busy' };
    const startedAt = this.clock.now();
    const shift: Shift = { shopId, slot, creatureId, startedAt, endsAt: startedAt + shop.shiftMs };
    this.state.shifts.push(shift);
    creature.status = 'working';
    return { ok: true, shift };
  }

  /** The shift in this shop slot, or undefined if the slot is free. */
  shiftAt(shopId: string, slot: number): Shift | undefined {
    return this.state.shifts.find((s) => s.shopId === shopId && s.slot === slot);
  }

  /** True if the shift in this shop slot exists and has ended at the current clock time. */
  isShiftComplete(shopId: string, slot: number): boolean {
    const shift = this.shiftAt(shopId, slot);
    return shift !== undefined && isShiftDone(shift, this.clock.now());
  }

  /** Real ms until the shift in this slot ends; 0 when done or the slot is free. */
  shiftTimeLeft(shopId: string, slot: number): number {
    const shift = this.shiftAt(shopId, slot);
    return shift ? Math.max(0, shift.endsAt - this.clock.now()) : 0;
  }

  /**
   * Collects a finished shift: its output goes to the inventory (or the coins,
   * for a workplace whose product is COINS_PRODUCT), the slot frees
   * and the creature goes home tired ('resting'). Before the end it gives nothing
   * and leaves the shift running.
   */
  collectShift(shopId: string, slot: number): { ok: true; itemId: string; count: number; creatureId: string } | { ok: false; reason: 'empty' | 'not_done' } {
    const shift = this.shiftAt(shopId, slot);
    if (!shift) return { ok: false, reason: 'empty' };
    if (!isShiftDone(shift, this.clock.now())) return { ok: false, reason: 'not_done' };
    const shop = this.shop(shopId);
    const creature = this.creature(shift.creatureId);
    const count = shiftOutput(this.speciesOf(creature), shop);
    if (shop.productItemId === COINS_PRODUCT) this.state.coins += count;
    else this.state.inventory[shop.productItemId] = (this.state.inventory[shop.productItemId] ?? 0) + count;
    this.state.shifts = this.state.shifts.filter((s) => s !== shift);
    creature.status = 'resting';
    return { ok: true, itemId: shop.productItemId, count, creatureId: creature.id };
  }

  /**
   * Buys `qty` of an item the market sells, at its JSON price. Refuses
   * (changing nothing) an item the market does not sell, a bad quantity, or
   * a cost above the coins held: coins never go negative.
   */
  buy(itemId: string, qty = 1): { ok: true; coins: number; count: number } | { ok: false; reason: 'not_sold' | 'bad_qty' | 'no_coins' } {
    const item = this.config.items.find((i) => i.id === itemId);
    if (!item || !item.buyable) return { ok: false, reason: 'not_sold' };
    if (!Number.isInteger(qty) || qty < 1) return { ok: false, reason: 'bad_qty' };
    const cost = item.price * qty;
    if (cost > this.state.coins) return { ok: false, reason: 'no_coins' };
    this.state.coins -= cost;
    this.state.inventory[itemId] = (this.state.inventory[itemId] ?? 0) + qty;
    return { ok: true, coins: this.state.coins, count: this.state.inventory[itemId] };
  }

  /**
   * Sells `qty` of an item the market buys, at its JSON price. Refuses
   * (changing nothing) an item the market does not buy, a bad quantity, or
   * more than the player holds.
   */
  sell(itemId: string, qty = 1): { ok: true; coins: number; count: number } | { ok: false; reason: 'not_bought' | 'bad_qty' | 'not_enough' } {
    const item = this.config.items.find((i) => i.id === itemId);
    if (!item || !item.sellable) return { ok: false, reason: 'not_bought' };
    if (!Number.isInteger(qty) || qty < 1) return { ok: false, reason: 'bad_qty' };
    const held = this.state.inventory[itemId] ?? 0;
    if (qty > held) return { ok: false, reason: 'not_enough' };
    this.state.inventory[itemId] = held - qty;
    this.state.coins += item.price * qty;
    return { ok: true, coins: this.state.coins, count: this.state.inventory[itemId] };
  }

  /** How many of a workplace's product the player holds (coins for coin-paying ones). */
  productCount(shopId: string): number {
    const id = this.shop(shopId).productItemId;
    return id === COINS_PRODUCT ? this.state.coins : (this.state.inventory[id] ?? 0);
  }

  /** In-game day and time now. */
  gameTime(): GameTime {
    return gameTimeAt(this.clock.now(), this.state.worldStartAt ?? this.clock.now(), this.config.time);
  }

  /** The shop with this id; throws if unknown. */
  shop(shopId: string): Shop {
    const s = this.config.shops.find((x) => x.id === shopId);
    if (!s) throw new Error(`Unknown shop "${shopId}"`);
    return s;
  }

  /**
   * Feeds one `itemId` from the inventory to a creature: energy rises by the
   * item's energyRestore, capped at the species' maxEnergy. Returns a reason
   * instead of throwing when the player simply can't (no item, wrong item),
   * because that is a normal in-game outcome, not a bug.
   */
  feed(creatureId: string, itemId: string): { ok: true; energy: number } | { ok: false; reason: 'no_item' | 'not_food' } {
    const creature = this.creature(creatureId);
    const item = this.config.items.find((i) => i.id === itemId);
    if (!item || item.energyRestore === undefined) return { ok: false, reason: 'not_food' };
    if ((this.state.inventory[itemId] ?? 0) <= 0) return { ok: false, reason: 'no_item' };
    this.state.inventory[itemId] -= 1;
    const max = this.speciesOf(creature).maxEnergy;
    creature.energy = Math.min(max, creature.energy + item.energyRestore);
    creature.energyAt = this.clock.now();
    return { ok: true, energy: creature.energy };
  }

  /**
   * Moves one `itemId` from the inventory into the home bowl, up to `capacity`
   * portions. Returns a reason when the player can't (no item, not food, bowl full).
   */
  fillBowl(itemId: string, capacity: number): { ok: true; bowl: number } | { ok: false; reason: 'no_item' | 'not_food' | 'full' } {
    const item = this.config.items.find((i) => i.id === itemId);
    if (!item || item.energyRestore === undefined) return { ok: false, reason: 'not_food' };
    const bowl = this.state.bowl ?? 0;
    if (bowl >= capacity) return { ok: false, reason: 'full' };
    if ((this.state.inventory[itemId] ?? 0) <= 0) return { ok: false, reason: 'no_item' };
    this.state.inventory[itemId] -= 1;
    this.state.bowl = bowl + 1;
    return { ok: true, bowl: this.state.bowl };
  }

  /**
   * A creature eats one portion of `itemId` from the bowl: energy rises by the
   * item's energyRestore, capped at max. Returns null if the bowl is empty.
   */
  eatFromBowl(creatureId: string, itemId: string): { energy: number } | null {
    const creature = this.creature(creatureId);
    const item = this.config.items.find((i) => i.id === itemId);
    if (!item || item.energyRestore === undefined || (this.state.bowl ?? 0) <= 0) return null;
    this.state.bowl = (this.state.bowl ?? 0) - 1;
    creature.energy = Math.min(this.speciesOf(creature).maxEnergy, creature.energy + item.energyRestore);
    creature.energyAt = this.clock.now();
    return { energy: creature.energy };
  }

  /**
   * Sends a creature to rest. Energy recovery over time is Story 004; this only
   * records the status. Throws on an unknown creature.
   */
  rest(creatureId: string): void {
    this.creature(creatureId).status = 'resting';
  }

  /** The creature with this id; throws if unknown. */
  creature(creatureId: string) {
    const c = this.state.creatures.find((x) => x.id === creatureId);
    if (!c) throw new Error(`Unknown creature "${creatureId}"`);
    return c;
  }

  /** Species definition for a creature; throws if its species is not in config. */
  speciesOf(creature: { speciesId: string }) {
    const s = this.config.species.find((x) => x.id === creature.speciesId);
    if (!s) throw new Error(`Unknown species "${creature.speciesId}"`);
    return s;
  }
}
