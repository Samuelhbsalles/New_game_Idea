import { Client, type Room } from '@colyseus/sdk';
import type { Storage } from '../logic/storage';

/** Answer to the server's 'load' request (server/src/rooms/WorldRoom.ts). */
interface LoadReply {
  accountId: string;
  displayName: string;
  save: string | null;
}

type SaveReply = { ok: true } | { ok: false; reason: string };

/**
 * Saves that live on the server. The game's Storage interface is synchronous,
 * so this keeps the last known save in memory: load() answers from it and
 * save() updates it and sends it to the server in the background.
 */
export class RemoteStorage implements Storage {
  constructor(
    private readonly room: Room,
    private cached: string | null,
    private readonly onError: (reason: string) => void = () => {},
  ) {}

  load(): string | null {
    return this.cached;
  }

  save(data: string): void {
    this.cached = data;
    this.room
      .request('save', data)
      .then((r) => {
        const reply = r as SaveReply;
        if (!reply.ok) this.onError(reply.reason);
      })
      .catch(() => this.onError('offline'));
  }
}

/** Another player's apartment as the server returns it (furniture still to be vetted). */
export interface HomeOf {
  name: string;
  home: unknown;
}

/** Fetches another player's apartment furniture for a visit; null if there is no such player. */
export async function fetchHomeOf(room: Room, accountId: string): Promise<HomeOf | null> {
  return ((await room.request('homeOf', { accountId })) as HomeOf | null) ?? null;
}

/** Game-registry key of the logged-in WorldSession. */
export const SESSION_KEY = 'world-session';

/** A logged-in session in the shared world. */
export interface WorldSession {
  room: Room;
  /** Our account id: our apartment is 'home:<accountId>'. */
  accountId: string;
  displayName: string;
  storage: RemoteStorage;
  /** True when this login moved the browser's old save into a brand-new account. */
  imported: boolean;
}

/** Where the game server is: same origin in dev (Vite plugin), or VITE_SERVER_URL. */
export function serverUrl(): string {
  return (import.meta.env.VITE_SERVER_URL as string | undefined) ?? location.origin;
}

/**
 * Logs into the world with a platform token ("dev:<name>" for now) and loads
 * the account's save. A brand-new account adopts the save already in this
 * browser, once (`localSave`), so nobody loses their creatures in the switch.
 * Throws when the server is unreachable or refuses the token.
 */
export async function joinWorld(token: string, localSave: Storage, onSaveError?: (reason: string) => void): Promise<WorldSession> {
  const client = new Client(serverUrl());
  client.auth.token = token;
  const room = await client.joinOrCreate('world');
  const reply = (await room.request('load')) as LoadReply;
  let save = reply.save;
  let imported = false;
  const local = localSave.load();
  if (save === null && local) {
    const r = (await room.request('import', local)) as SaveReply;
    if (r.ok) {
      save = local;
      imported = true;
    }
  }
  return { room, accountId: reply.accountId, displayName: reply.displayName, storage: new RemoteStorage(room, save, onSaveError), imported };
}
