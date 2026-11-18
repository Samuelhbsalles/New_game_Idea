/**
 * The harbour ferry: pay a fare at the ticket booth to sail to another biome;
 * the trip back is free. Destinations still being built are listed as "soon".
 * Data: src/data/ferry.json. Render-independent.
 */

export type FerryStatus = 'open' | 'soon';

export interface FerryDestination {
  id: string;
  status: FerryStatus;
  /** Map the trip sails to (required when open), e.g. "shore". */
  map?: string;
}

export interface FerryRules {
  /** Coins for one trip out. */
  fare: number;
  /** True when sailing back to town costs nothing. */
  returnFree: boolean;
  /** Where the player stands to talk to the booth (town px; x, y = top-left). */
  booth: { x: number; y: number; w: number; h: number };
  destinations: FerryDestination[];
  /** The clerk in the booth: when they greet and how lively they are. */
  clerk: ClerkRules;
}

/** The ticket clerk's manners. */
export interface ClerkRules {
  /** The clerk waves and says hello when the player comes this close (px). */
  greetRadius: number;
  /** ...and is ready to greet again once the player has gone this far (px). */
  leaveRadius: number;
  /** Wave animation speed (frames per second). */
  waveFps: number;
  /** Pause after "have a good trip!" before the boat leaves (ms). */
  farewellMs: number;
}

export type TicketResult = { ok: true; coins: number; map: string } | { ok: false; reason: 'unknown' | 'soon' | 'no_coins' };

const fail = (path: string, msg: string): never => {
  throw new Error(`ferry.json ${path}: ${msg}`);
};
const obj = (v: unknown, path: string): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : fail(path, 'expected an object'));
const num = (o: Record<string, unknown>, k: string, path: string, min = 0): number => {
  const v = o[k];
  return typeof v === 'number' && Number.isFinite(v) && v >= min ? v : fail(`${path}.${k}`.replace(/^\./, ''), `expected a number >= ${min}`);
};

/** Validates ferry.json. Throws with the offending path. */
export function parseFerry(json: unknown): FerryRules {
  const o = obj(json, '(root)');
  if (typeof o.returnFree !== 'boolean') fail('returnFree', 'expected true or false');
  const b = obj(o.booth, 'booth');
  if (!Array.isArray(o.destinations) || o.destinations.length === 0) fail('destinations', 'expected at least one');
  const seen = new Set<string>();
  const destinations = (o.destinations as unknown[]).map((d, i): FerryDestination => {
    const p = `destinations[${i}]`;
    const dobj = obj(d, p);
    const id = typeof dobj.id === 'string' && dobj.id !== '' ? dobj.id : fail(`${p}.id`, 'expected a name');
    if (seen.has(id)) fail(`${p}.id`, `"${id}" is listed twice`);
    seen.add(id);
    const status = dobj.status === 'open' || dobj.status === 'soon' ? dobj.status : fail(`${p}.status`, 'expected "open" or "soon"');
    const dest: FerryDestination = { id, status };
    if (typeof dobj.map === 'string' && dobj.map !== '') dest.map = dobj.map;
    if (status === 'open' && !dest.map) fail(`${p}.map`, 'an open destination needs a map');
    return dest;
  });
  return {
    fare: num(o, 'fare', ''),
    returnFree: o.returnFree as boolean,
    booth: { x: num(b, 'x', 'booth'), y: num(b, 'y', 'booth'), w: num(b, 'w', 'booth', 1), h: num(b, 'h', 'booth', 1) },
    destinations,
    clerk: parseClerk(o.clerk),
  };
}

function parseClerk(v: unknown): ClerkRules {
  const c = obj(v, 'clerk');
  const clerk = {
    greetRadius: num(c, 'greetRadius', 'clerk', 1),
    leaveRadius: num(c, 'leaveRadius', 'clerk', 1),
    waveFps: num(c, 'waveFps', 'clerk', 1),
    farewellMs: num(c, 'farewellMs', 'clerk', 0),
  };
  if (clerk.leaveRadius < clerk.greetRadius) fail('clerk.leaveRadius', 'must be at least greetRadius');
  return clerk;
}

/**
 * Whether the clerk greets the player now. They greet once on coming within
 * `greetRadius`, then not again until the player has walked past
 * `leaveRadius` (so standing at the edge does not make them say hello twice).
 */
export function clerkGreets(greeted: boolean, distance: number, c: ClerkRules): { greeted: boolean; greetNow: boolean } {
  if (!greeted && distance <= c.greetRadius) return { greeted: true, greetNow: true };
  if (greeted && distance > c.leaveRadius) return { greeted: false, greetNow: false };
  return { greeted, greetNow: false };
}

/**
 * Buys a trip out to `destId`: takes the fare from the wallet and returns the
 * map to sail to. Nothing is charged when the trip can't happen.
 */
export function buyTicket(wallet: { coins: number }, rules: FerryRules, destId: string): TicketResult {
  const dest = rules.destinations.find((d) => d.id === destId);
  if (!dest) return { ok: false, reason: 'unknown' };
  if (dest.status !== 'open' || !dest.map) return { ok: false, reason: 'soon' };
  if (wallet.coins < rules.fare) return { ok: false, reason: 'no_coins' };
  wallet.coins -= rules.fare;
  return { ok: true, coins: wallet.coins, map: dest.map };
}

/** True when a point (the player's feet) is in front of the ticket booth. */
export function inBooth(rules: FerryRules, p: { x: number; y: number }): boolean {
  const b = rules.booth;
  return p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h;
}
