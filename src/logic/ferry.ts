/**
 * The harbour ferry: pay a fare at the ticket booth to sail to another biome;
 * the trip back is free. Destinations still being built are listed as "soon".
 * Data: src/data/ferry.json. Render-independent.
 */

export type FerryStatus = 'open' | 'soon';

export interface FerryDestination {
  id: string;
  status: FerryStatus;
  /** Scene that the trip opens (required when open). */
  scene?: string;
}

export interface FerryRules {
  /** Coins for one trip out. */
  fare: number;
  /** True when sailing back to town costs nothing. */
  returnFree: boolean;
  /** Where the player stands to talk to the booth (town px; x, y = top-left). */
  booth: { x: number; y: number; w: number; h: number };
  destinations: FerryDestination[];
}

export type TicketResult = { ok: true; coins: number; scene: string } | { ok: false; reason: 'unknown' | 'soon' | 'no_coins' };

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
    if (typeof dobj.scene === 'string' && dobj.scene !== '') dest.scene = dobj.scene;
    if (status === 'open' && !dest.scene) fail(`${p}.scene`, 'an open destination needs a scene');
    return dest;
  });
  return {
    fare: num(o, 'fare', ''),
    returnFree: o.returnFree as boolean,
    booth: { x: num(b, 'x', 'booth'), y: num(b, 'y', 'booth'), w: num(b, 'w', 'booth', 1), h: num(b, 'h', 'booth', 1) },
    destinations,
  };
}

/**
 * Buys a trip out to `destId`: takes the fare from the wallet and returns the
 * scene to open. Nothing is charged when the trip can't happen.
 */
export function buyTicket(wallet: { coins: number }, rules: FerryRules, destId: string): TicketResult {
  const dest = rules.destinations.find((d) => d.id === destId);
  if (!dest) return { ok: false, reason: 'unknown' };
  if (dest.status !== 'open' || !dest.scene) return { ok: false, reason: 'soon' };
  if (wallet.coins < rules.fare) return { ok: false, reason: 'no_coins' };
  wallet.coins -= rules.fare;
  return { ok: true, coins: wallet.coins, scene: dest.scene };
}

/** True when a point (the player's feet) is in front of the ticket booth. */
export function inBooth(rules: FerryRules, p: { x: number; y: number }): boolean {
  const b = rules.booth;
  return p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h;
}
