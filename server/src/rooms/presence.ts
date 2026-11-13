import { schema, t, type SchemaType } from '@colyseus/schema';

/** One connected player as everyone else sees them. */
export const PlayerState = schema(
  {
    name: t.string(),
    /** Where they are: 'town', 'interior:<building>' ('' until their first move). */
    place: t.string(),
    x: t.number(),
    y: t.number(),
    face: t.string(),
    moving: t.boolean(),
    /** Their look: the appearance JSON from the character creator ('' = default). */
    look: t.string(),
  },
  'PlayerState',
);
export type PlayerState = SchemaType<typeof PlayerState>;

/** The world everyone shares; keyed by session id. */
export const WorldState = schema({ players: t.map(PlayerState) }, 'WorldState');
export type WorldState = SchemaType<typeof WorldState>;

/** A position update from a client. */
export interface Move {
  place: string;
  x: number;
  y: number;
  face: 'up' | 'down' | 'left' | 'right';
  moving: boolean;
}

/** Largest coordinate accepted (the town is 1600x896 px). */
export const MAX_COORD = 8192;
const PLACE = /^[a-zA-Z0-9:_-]{1,40}$/;
const FACES = ['up', 'down', 'left', 'right'];

/**
 * Checks a client's position update. Anything malformed is dropped (null)
 * rather than half-applied: a bad client must not be able to put junk into
 * what every other player receives.
 */
export function sanitizeMove(raw: unknown): Move | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const coord = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_COORD;
  if (typeof o.place !== 'string' || !PLACE.test(o.place)) return null;
  if (!coord(o.x) || !coord(o.y)) return null;
  if (typeof o.face !== 'string' || !FACES.includes(o.face)) return null;
  if (typeof o.moving !== 'boolean') return null;
  return { place: o.place, x: Math.round(o.x as number), y: Math.round(o.y as number), face: o.face as Move['face'], moving: o.moving };
}

/** Largest look (appearance JSON) accepted. Today's are about 150 bytes. */
export const MAX_LOOK_BYTES = 1024;

/** A look the client sent, if it is a small JSON object; else null. Its fields are vetted by each client against the cosmetics catalog. */
export function sanitizeLook(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > MAX_LOOK_BYTES) return null;
  try {
    const v = JSON.parse(raw);
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? raw : null;
  } catch {
    return null;
  }
}
