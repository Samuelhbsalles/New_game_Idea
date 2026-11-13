import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { defineRoom, defineServer } from 'colyseus';
import { AccountStore } from './db/accounts';
import { DevIdentityProvider } from './identity/devIdentity';
import type { IdentityProvider } from './identity/identity';
import { WorldRoom } from './rooms/WorldRoom';
import { configureWorld } from './world';

/**
 * Server entry (loaded by the Colyseus Vite plugin in dev, and by the
 * production entry it builds). Settings come from the environment:
 * - WORLD_DB: SQLite file (default server/data/world.sqlite; ':memory:' for tests)
 * - DEV_LOGIN: '1' allows the name-only dev login (never on a public server)
 */
const dbPath = process.env.WORLD_DB ?? 'server/data/world.sqlite';
if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });

const providers: IdentityProvider[] = [];
if (process.env.DEV_LOGIN === '1' || process.env.NODE_ENV !== 'production') providers.push(new DevIdentityProvider());

configureWorld({ accounts: new AccountStore(dbPath), providers });

export const server = defineServer({
  rooms: {
    world: defineRoom(WorldRoom),
  },
});
