import { Room, type Client } from 'colyseus';
import { PlayerState, sanitizeLook, sanitizeMove, WorldState } from './presence';
import { deserialize } from '../../../src/logic/state';
import type { Account } from '../db/accounts';
import { resolveIdentity } from '../identity/identity';
import { world } from '../world';

/** Largest save the server accepts (bytes of JSON). Today's saves are a few KB. */
export const MAX_SAVE_BYTES = 256 * 1024;

/** Answer to the 'load' request. */
export interface LoadReply {
  displayName: string;
  /** Their save, or null for a brand-new account. */
  save: string | null;
}

/** Answer to the 'save' and 'import' requests. */
export type SaveReply = { ok: true } | { ok: false; reason: 'invalid' | 'exists' | 'unauthenticated' };

/** What onAuth hands to onJoin (and keeps as client.auth). */
interface AuthData {
  account: Account;
}

/**
 * The shared world. Phase 2: everyone's place, position and look are in the
 * synced state (players), so each client can draw the others. Phase 1: players join with a platform token; the server
 * finds or creates their account. The client asks for its save ('load') and
 * sends it back after changes ('save'); the first login may adopt the save
 * that lived in the browser ('import', only into an empty account). The game
 * rules still run in the client; phase 3 moves them here
 * (docs/architecture/adr-0001-online-architecture.md).
 */
export class WorldRoom extends Room<{ state: WorldState }> {
  state = new WorldState();

  /** Verifies the platform token and loads (or creates) the account. Falsy = rejected. */
  static async onAuth(token: string): Promise<AuthData | false> {
    const { accounts, providers } = world();
    const identity = await resolveIdentity(token, providers);
    if (!identity) return false;
    return { account: accounts.findOrCreate(identity) };
  }

  onCreate(): void {
    this.onMessage('load', (client): LoadReply | null => {
      const auth = client.auth as AuthData | undefined;
      if (!auth) return null;
      return { displayName: auth.account.displayName, save: world().accounts.loadSave(auth.account.id) };
    });
    this.onMessage('save', (client, data: unknown) => this.store(client, data, false));
    // Phase 2, presence: where each player is and how they look, shared with everyone.
    this.onMessage('move', (client, raw: unknown) => {
      const p = this.state.players.get(client.sessionId);
      const m = sanitizeMove(raw);
      if (!p || !m) return;
      p.place = m.place;
      p.x = m.x;
      p.y = m.y;
      p.face = m.face;
      p.moving = m.moving;
    });
    this.onMessage('look', (client, raw: unknown) => {
      const p = this.state.players.get(client.sessionId);
      const look = sanitizeLook(raw);
      if (p && look !== null) p.look = look;
    });
    this.onMessage('import', (client, data: unknown) => this.store(client, data, true));
  }

  onJoin(client: Client, _options: unknown, auth: AuthData): void {
    this.state.players.set(client.sessionId, new PlayerState({ name: auth.account.displayName, place: '', x: 0, y: 0, face: 'down', moving: false, look: '' }));
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
  }

  /**
   * Stores a save after checking it is one the game itself would load.
   * An import only lands on an account that has no save yet.
   */
  private store(client: Client, data: unknown, onlyIfEmpty: boolean): SaveReply {
    const auth = client.auth as AuthData | undefined;
    if (!auth) return { ok: false, reason: 'unauthenticated' };
    const valid = typeof data === 'string' && data.length <= MAX_SAVE_BYTES && deserialize(data) !== null;
    if (!valid) return { ok: false, reason: 'invalid' };
    const { accounts } = world();
    if (onlyIfEmpty && accounts.loadSave(auth.account.id) !== null) return { ok: false, reason: 'exists' };
    accounts.writeSave(auth.account.id, data);
    return { ok: true };
  }
}
