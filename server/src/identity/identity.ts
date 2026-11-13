/**
 * Who a player is, as vouched for by the platform they play on (a game
 * portal, Discord, or the dev name login). The game never handles passwords:
 * the platform logs the player in and hands the client a token, which the
 * server checks here.
 */
export interface Identity {
  /** Which platform vouched for this player ('dev', later e.g. 'crazygames', 'discord'). */
  platform: string;
  /** The player's id on that platform; stable across sessions. */
  userId: string;
  /** Name to show above the player. */
  displayName: string;
}

/** Checks one platform's tokens. */
export interface IdentityProvider {
  /** Token prefix this provider handles, e.g. 'dev' for "dev:Samuel". */
  readonly platform: string;
  /** The identity the token proves, or null when it proves nothing. */
  verify(token: string): Promise<Identity | null>;
}

/**
 * Picks the provider by the token's "<platform>:" prefix and lets it verify
 * the rest. Unknown platforms and malformed tokens prove nothing (null).
 * @example await resolveIdentity('dev:Samuel', [new DevIdentityProvider()]);
 */
export async function resolveIdentity(token: string | undefined, providers: IdentityProvider[]): Promise<Identity | null> {
  if (!token) return null;
  const i = token.indexOf(':');
  if (i <= 0) return null;
  const platform = token.slice(0, i);
  const provider = providers.find((p) => p.platform === platform);
  return provider ? provider.verify(token.slice(i + 1)) : null;
}
