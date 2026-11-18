/**
 * Rides from the sports shop (skateboard, roller skates, later a bicycle):
 * buy one with coins, then get on it from the bag to move faster outdoors.
 * Only one ride is used at a time; indoors everyone walks.
 * Data: src/data/rides.json. Render-independent.
 */

export type RideStatus = 'open' | 'soon';

/** One thing the sports shop sells. */
export interface Ride {
  id: string;
  /** Coins to buy it. */
  price: number;
  /** Extra speed while riding: 0.3 = 30% faster than walking. */
  speedBonus: number;
  /** "soon" = listed in the shop but not for sale yet. */
  status: RideStatus;
  /** Speed on rough ground (grass, sand) as a share of walking speed: wheels don't roll there. */
  roughFactor: number;
  /** How it looks under the player (rides on sale need one). */
  look?: RideLook;
}

/**
 * How a ride is drawn and how the player moves on it.
 * - "push": a skateboard — a kick with one foot (the walk cycle), then a glide standing still.
 * - "stride": roller skates — the walk cycle the whole time (skating strides).
 */
export interface RideLook {
  /** Drawn over the shoes (roller skates) instead of under the feet (a board). */
  over: boolean;
  /** Px below the player's feet line where the ride's bottom sits. */
  dy: number;
  style: 'push' | 'stride';
  /** "push" only: how long each kick and each glide lasts (ms). */
  pushMs?: number;
  glideMs?: number;
}

/** The sports shop. */
export interface RideRules {
  rides: Ride[];
}

/** The part of the save rides touch. */
export interface RideWallet {
  coins: number;
  /** Ids of the rides owned. Missing = none. */
  rides?: string[];
  /** Id of the ride in use. Missing = walking. */
  riding?: string;
}

export type RideBuy = { ok: true; coins: number } | { ok: false; reason: 'unknown' | 'soon' | 'owned' | 'no_coins' };

const fail = (path: string, msg: string): never => {
  throw new Error(`rides.json ${path}: ${msg}`);
};

/** Validates rides.json. Throws with the offending path. */
export function parseRides(json: unknown): RideRules {
  const o = json && typeof json === 'object' && !Array.isArray(json) ? (json as Record<string, unknown>) : fail('(root)', 'expected an object');
  if (!Array.isArray(o.rides) || o.rides.length === 0) fail('rides', 'expected at least one ride');
  const seen = new Set<string>();
  const rides = (o.rides as unknown[]).map((r, i): Ride => {
    const p = `rides[${i}]`;
    const ro = r && typeof r === 'object' ? (r as Record<string, unknown>) : fail(p, 'expected an object');
    const id = typeof ro.id === 'string' && ro.id !== '' ? ro.id : fail(`${p}.id`, 'expected a name');
    if (seen.has(id)) fail(`${p}.id`, `"${id}" is listed twice`);
    seen.add(id);
    const price = typeof ro.price === 'number' && Number.isInteger(ro.price) && ro.price >= 0 ? ro.price : fail(`${p}.price`, 'expected a whole number >= 0');
    const speedBonus = typeof ro.speedBonus === 'number' && ro.speedBonus > 0 && ro.speedBonus <= 3 ? ro.speedBonus : fail(`${p}.speedBonus`, 'expected a number in (0, 3]');
    const status = ro.status === 'open' || ro.status === 'soon' ? ro.status : fail(`${p}.status`, 'expected "open" or "soon"');
    const roughFactor = typeof ro.roughFactor === 'number' && ro.roughFactor > 0 && ro.roughFactor <= 1 ? ro.roughFactor : fail(`${p}.roughFactor`, 'expected a number in (0, 1]');
    const ride: Ride = { id, price, speedBonus, status, roughFactor };
    if (ro.look !== undefined) ride.look = parseLook(ro.look, `${p}.look`);
    else if (status === 'open') fail(`${p}.look`, 'a ride on sale needs a look');
    return ride;
  });
  return { rides };
}

function parseLook(v: unknown, p: string): RideLook {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : fail(p, 'expected an object');
  if (typeof o.over !== 'boolean') fail(`${p}.over`, 'expected true or false');
  if (typeof o.dy !== 'number') fail(`${p}.dy`, 'expected a number');
  const style = o.style === 'push' || o.style === 'stride' ? o.style : fail(`${p}.style`, 'expected "push" or "stride"');
  const look: RideLook = { over: o.over as boolean, dy: o.dy as number, style };
  if (style === 'push') {
    const ms = (k: 'pushMs' | 'glideMs') => (typeof o[k] === 'number' && (o[k] as number) > 0 ? (o[k] as number) : fail(`${p}.${k}`, 'expected a number > 0 for a "push" ride'));
    look.pushMs = ms('pushMs');
    look.glideMs = ms('glideMs');
  }
  return look;
}

/**
 * Whether a "push" ride is in the kick (legs moving) or the glide at `elapsedMs`
 * since the player started rolling: kick first, then glide, repeating.
 */
export function pushPhase(look: RideLook, elapsedMs: number): 'kick' | 'glide' {
  if (look.style !== 'push' || !look.pushMs || !look.glideMs) return 'kick';
  return elapsedMs % (look.pushMs + look.glideMs) < look.pushMs ? 'kick' : 'glide';
}

/** Buys `id`: takes its price and adds it to the rides owned. Nothing changes when it can't be bought. */
export function buyRide(wallet: RideWallet, rules: RideRules, id: string): RideBuy {
  const ride = rules.rides.find((r) => r.id === id);
  if (!ride) return { ok: false, reason: 'unknown' };
  if (ride.status !== 'open') return { ok: false, reason: 'soon' };
  if (wallet.rides?.includes(id)) return { ok: false, reason: 'owned' };
  if (wallet.coins < ride.price) return { ok: false, reason: 'no_coins' };
  wallet.coins -= ride.price;
  wallet.rides = [...(wallet.rides ?? []), id];
  return { ok: true, coins: wallet.coins };
}

/**
 * Gets on `id`, or off it when already riding it. Getting on another ride
 * swaps (only one at a time). Returns what the player is riding afterwards,
 * or 'not_owned' (and changes nothing) for a ride they do not have.
 */
export function toggleRide(wallet: RideWallet, id: string): string | null | 'not_owned' {
  if (!wallet.rides?.includes(id)) return 'not_owned';
  if (wallet.riding === id) {
    delete wallet.riding;
    return null;
  }
  wallet.riding = id;
  return id;
}

/** The ride in use, if the player owns it and the shop knows it (a stale save rides nothing). */
export function currentRide(wallet: RideWallet, rules: RideRules): Ride | null {
  if (!wallet.riding || !wallet.rides?.includes(wallet.riding)) return null;
  return rules.rides.find((r) => r.id === wallet.riding && r.status === 'open') ?? null;
}

/** What the ground under the player is like for wheels. */
export type Surface = 'paved' | 'rough';

/**
 * Walking speed multiplier outdoors: 1 on foot; on a ride, 1 + speedBonus on
 * paved ground, and roughFactor (slower than walking) on grass or sand.
 */
export function speedFactor(wallet: RideWallet, rules: RideRules, surface: Surface = 'paved'): number {
  const ride = currentRide(wallet, rules);
  if (!ride) return 1;
  return surface === 'paved' ? 1 + ride.speedBonus : ride.roughFactor;
}
