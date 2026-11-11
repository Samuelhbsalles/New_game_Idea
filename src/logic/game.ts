import type { Clock } from './clock';
import { deserialize, isShiftDone, newGame, serialize } from './state';
import type { Storage } from './storage';
import type { Config, GameState, Shift } from './types';

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
    return new Game(config, clock, storage, deserialize(data) ?? newGame(config, clock));
  }

  /** Writes the current state through the Storage. */
  save(): void {
    this.storage.save(serialize(this.state));
  }

  /**
   * Minimal shift start: records startedAt = clock.now() and
   * endsAt = startedAt + the shop's shiftMs. Slot limits, occupancy, energy and
   * production are not enforced here (stories 002/004). Throws on an unknown creature or shop.
   */
  startShift(creatureId: string, shopId: string, slot: number): Shift {
    const creature = this.state.creatures.find((c) => c.id === creatureId);
    if (!creature) throw new Error(`Unknown creature "${creatureId}"`);
    const shop = this.config.shops.find((s) => s.id === shopId);
    if (!shop) throw new Error(`Unknown shop "${shopId}"`);
    const startedAt = this.clock.now();
    const shift: Shift = { shopId, slot, creatureId, startedAt, endsAt: startedAt + shop.shiftMs };
    this.state.shifts.push(shift);
    creature.status = 'working';
    return shift;
  }

  /** True if the shift in this shop slot exists and has ended at the current clock time. */
  isShiftComplete(shopId: string, slot: number): boolean {
    const shift = this.state.shifts.find((s) => s.shopId === shopId && s.slot === slot);
    return shift !== undefined && isShiftDone(shift, this.clock.now());
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
