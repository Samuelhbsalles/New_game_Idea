import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { Identity } from '../identity/identity';

/** A player's account: one per platform identity, holding their save. */
export interface Account {
  id: string;
  platform: string;
  platformUserId: string;
  displayName: string;
}

/**
 * Accounts and saves in SQLite (Node's built-in driver, no native add-on).
 * Pass ':memory:' for tests. The save is the same JSON string the game's
 * Storage interface already reads and writes, so the client's rules and the
 * server agree on one format.
 */
export class AccountStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        platform_user_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        save TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE (platform, platform_user_id)
      )`);
  }

  /** The account for this identity, created on first sight. Keeps the display name current. */
  findOrCreate(identity: Identity, now = Date.now()): Account {
    const row = this.db
      .prepare('SELECT id FROM accounts WHERE platform = ? AND platform_user_id = ?')
      .get(identity.platform, identity.userId) as { id: string } | undefined;
    if (row) {
      this.db.prepare('UPDATE accounts SET display_name = ?, updated_at = ? WHERE id = ?').run(identity.displayName, now, row.id);
      return { id: row.id, platform: identity.platform, platformUserId: identity.userId, displayName: identity.displayName };
    }
    const id = randomUUID();
    this.db
      .prepare('INSERT INTO accounts (id, platform, platform_user_id, display_name, save, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, ?, ?)')
      .run(id, identity.platform, identity.userId, identity.displayName, now, now);
    return { id, platform: identity.platform, platformUserId: identity.userId, displayName: identity.displayName };
  }

  /** An account's public name and save by id, or null if there is no such account. */
  findById(accountId: string): { displayName: string; save: string | null } | null {
    const row = this.db.prepare('SELECT display_name, save FROM accounts WHERE id = ?').get(accountId) as { display_name: string; save: string | null } | undefined;
    return row ? { displayName: row.display_name, save: row.save } : null;
  }

  /** The account's save string, or null when it has none yet. */
  loadSave(accountId: string): string | null {
    const row = this.db.prepare('SELECT save FROM accounts WHERE id = ?').get(accountId) as { save: string | null } | undefined;
    return row?.save ?? null;
  }

  /** Replaces the account's save. */
  writeSave(accountId: string, save: string, now = Date.now()): void {
    this.db.prepare('UPDATE accounts SET save = ?, updated_at = ? WHERE id = ?').run(save, now, accountId);
  }

  close(): void {
    this.db.close();
  }
}
