import { atHome, moodOf, baitFans, itemKind, leaveHome, partyOf, tabItems, takeAlong, type BagRules, type BagTab } from '../logic/bag';
import type { Game } from '../logic/game';
import type { BagAction, BagContent, BagSlot } from './ui/BagPanel';

/** Bag slot ids of rides start with this, so they never clash with item ids. */
const RIDE_PREFIX = 'ride:';

/** What the scene lets the bag do where the player is. */
export interface BagOptions {
  game: Game;
  rules: BagRules;
  genericBaitId: string;
  t: (k: string, v?: Record<string, string | number>) => string;
  /** Sprite name of a species (for the creatures tab), or null without art. */
  artName: (species: string) => string | null;
  /** In a wild area in town: put this bait down. Null when bait can't go down here. */
  placeBait: ((itemId: string) => void) | null;
  /** Why bait can't go down here (shown when E is pressed on a bait), when placeBait is null. */
  baitBlocked?: string;
  /** At home: creatures can be swapped between the bag and the apartment. */
  atHome: boolean;
  /** In town: who follows the player, and switching it (null = no following here). */
  follow?: { current: () => string | null; toggle: (creatureId: string) => void } | null;
  /** Send a creature from the party home (works anywhere; it waits in the apartment). */
  sendHome?: ((creatureId: string) => void) | null;
  /** Rides from the sports shop: what is owned, and getting on/off. Null where rides can't be used (indoors). */
  rides?: { owned: { id: string; speedBonus: number }[]; current: () => string | null; toggle: (id: string) => void } | null;
  /** Why rides can't be used here (shown when E is pressed on one), when rides is null. */
  ridesBlocked?: string;
  /** Rides owned, shown (but not usable) where rides is null. */
  ridesOwned?: string[];
  /** Something changed (save + redraw). */
  changed: () => void;
  /** A short message (e.g. why a swap was refused). */
  say: (msg: string) => void;
}

/**
 * Fills the bag panel from the game state: baits (with who loves them), other
 * items, and creatures — the ones with you, plus the ones at home when the
 * player is at home (dimmed), where they can be swapped.
 */
export function bagContent(o: BagOptions): BagContent {
  const { game, t } = o;
  const max = o.rules.partyMax;
  const itemSlot = (itemId: string, count: number): BagSlot => {
    const kind = itemKind(game.config, o.genericBaitId, itemId);
    const fans = baitFans(game.config, itemId).map((s) => t(`species.${s}`));
    const description = kind === 'bait' ? (fans.length ? t('bag.loves', { list: fans.join(', ') }) : t('bag.generic')) : t(`bag.${kind}`);
    return { id: itemId, texture: `item_${itemId}`, count, name: t(`items.${itemId}`), description };
  };
  const maxEnergy = (species: string) => game.config.species.find((x) => x.id === species)?.maxEnergy ?? 100;
  const creatureSlot = (id: string, home: boolean): BagSlot => {
    const c = game.state.creatures.find((x) => x.id === id)!;
    const art = o.artName(c.speciesId);
    const energy = game.energyOf(id);
    const tag = home ? t('bag.atHomeTag') : t('bag.withYou');
    return {
      id,
      texture: art ? `${art}_idle_down` : null,
      name: t(`species.${c.speciesId}`),
      description: `${tag} · ${t('bag.creatureInfo', { energy: Math.floor(energy), status: t(`bag.mood.${moodOf(c.status, energy, maxEnergy(c.speciesId))}`) })}`,
      faded: home,
    };
  };
  // Rides live in the items tab, after the goods; their slot ids are "ride:<id>".
  const rideSlots = (): BagSlot[] => {
    const owned = o.rides?.owned ?? (o.ridesOwned ?? []).map((id) => ({ id, speedBonus: 0 }));
    const riding = o.rides?.current() ?? null;
    return owned.map((r) => ({
      id: `${RIDE_PREFIX}${r.id}`,
      texture: `ride_${r.id}_icon`,
      name: t(`rides.${r.id}`),
      description: riding === r.id ? t('rides.inUse') : o.rides ? t('rides.faster', { pct: Math.round(r.speedBonus * 100) }) : (o.ridesBlocked ?? ''),
    }));
  };
  return {
    tabs: o.rules.tabs,
    tabLabel: (tab) => t(`bag.tab.${tab}`),
    title: t('bag.title'),
    empty: t('bag.empty'),
    help: t('bag.help'),
    options: t('bag.options'),
    // Creatures: one row for the party (its size is the limit); at home, rows below for those waiting there.
    rows: (tab: BagTab) => {
      if (tab !== 'creatures') return o.rules.rows;
      if (!o.atHome) return Math.ceil(max / o.rules.cols);
      return Math.ceil(max / o.rules.cols) + Math.max(1, Math.ceil(atHome(game, max).length / o.rules.cols));
    },
    slots: (tab: BagTab) => {
      if (tab === 'creatures') {
        const partyRow = Math.ceil(max / o.rules.cols) * o.rules.cols;
        const party: (BagSlot | null)[] = partyOf(game, max).map((id) => creatureSlot(id, false));
        while (party.length < partyRow) party.push(null);
        return o.atHome ? [...party, ...atHome(game, max).map((id) => creatureSlot(id, true))] : party;
      }
      const items = tabItems(game, o.genericBaitId, tab).map((i) => itemSlot(i.itemId, i.count));
      return tab === 'items' ? [...items, ...rideSlots()] : items;
    },
    actions: (tab, slot): BagAction[] => {
      if (tab === 'baits') {
        const place = o.placeBait;
        // E always answers: it puts the bait down, or says why it can't here.
        return [{ label: t('bag.placeBait'), run: () => (place ? place(slot.id) : o.say(o.baitBlocked ?? t('bag.placeHere'))) }];
      }
      if (tab === 'items' && slot.id.startsWith(RIDE_PREFIX)) {
        const id = slot.id.slice(RIDE_PREFIX.length);
        const rides = o.rides ?? null;
        if (!rides) return [{ label: t('rides.use'), run: () => o.say(o.ridesBlocked ?? '') }];
        return [{ label: t(rides.current() === id ? 'rides.getOff' : 'rides.use'), run: () => rides.toggle(id) }];
      }
      if (tab !== 'creatures') return [];
      const list: BagAction[] = [];
      if (slot.faded) {
        list.push({ label: t('bag.takeAlong'), run: () => (takeAlong(game, slot.id, max) === 'full' ? o.say(t('bag.partyFull', { max })) : o.changed()) });
        return list;
      }
      if (o.follow) {
        const follow = o.follow;
        const following = follow.current() === slot.id;
        list.push({ label: t(following ? 'bag.stopFollow' : 'bag.followMe'), run: () => follow.toggle(slot.id) });
      }
      const home = o.sendHome ?? null;
      list.push({
        label: t(o.atHome ? 'bag.leaveHome' : 'bag.sendHome'),
        run: () => {
          if (leaveHome(game, slot.id, max) === 'last') return o.say(t('bag.lastOne'));
          home?.(slot.id);
          o.changed();
        },
      });
      return list;
    },
  };
}
