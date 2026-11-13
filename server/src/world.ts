import type { AccountStore } from './db/accounts';
import type { IdentityProvider } from './identity/identity';

/** What the rooms need from the outside world; set once at startup (or per test). */
export interface WorldDeps {
  accounts: AccountStore;
  providers: IdentityProvider[];
}

let deps: WorldDeps | null = null;

/** Sets the account store and identity providers the rooms use. */
export function configureWorld(next: WorldDeps): void {
  deps = next;
}

/** The configured dependencies; throws if the server was started without them. */
export function world(): WorldDeps {
  if (!deps) throw new Error('configureWorld() was not called before rooms started');
  return deps;
}
