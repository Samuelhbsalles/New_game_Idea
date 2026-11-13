import type { Identity, IdentityProvider } from './identity';

/** Letters (any language), digits, space, '_' and '-', 2 to 16 characters. */
const NAME = /^[\p{L}\p{N} _-]{2,16}$/u;

/**
 * Development login: the token is just the player's chosen name, so anyone
 * can be anyone. Never enable it on a public server; real players come in
 * through a platform provider (portal or Discord) instead.
 */
export class DevIdentityProvider implements IdentityProvider {
  readonly platform = 'dev';

  async verify(name: string): Promise<Identity | null> {
    const display = name.trim().replace(/\s+/g, ' ');
    if (!NAME.test(display)) return null;
    return { platform: this.platform, userId: display.toLowerCase(), displayName: display };
  }
}
