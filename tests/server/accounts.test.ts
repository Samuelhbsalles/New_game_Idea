import { afterEach, describe, expect, it } from 'vitest';
import { AccountStore } from '../../server/src/db/accounts';
import { DevIdentityProvider } from '../../server/src/identity/devIdentity';
import { resolveIdentity, type IdentityProvider } from '../../server/src/identity/identity';

const dev = new DevIdentityProvider();
const stores: AccountStore[] = [];
const fresh = () => {
  const s = new AccountStore(':memory:');
  stores.push(s);
  return s;
};
afterEach(() => stores.splice(0).forEach((s) => s.close()));

describe('identity', () => {
  it('dev login: the name is the identity, case-insensitive id, trimmed display', async () => {
    expect(await resolveIdentity('dev:  Ana  Clara ', [dev])).toEqual({ platform: 'dev', userId: 'ana clara', displayName: 'Ana Clara' });
    expect(await resolveIdentity('dev:Ção_2', [dev])).toMatchObject({ displayName: 'Ção_2' });
  });

  it('rejects empty, too long, odd characters, missing or unknown platform', async () => {
    for (const t of [undefined, '', 'Ana', 'dev:', 'dev:a', 'dev:' + 'x'.repeat(17), 'dev:<script>', 'discord:Ana']) {
      expect(await resolveIdentity(t, [dev]), String(t)).toBeNull();
    }
  });

  it('routes a token to the provider named by its prefix', async () => {
    const fake: IdentityProvider = { platform: 'portal', verify: async (tok) => (tok === 'good' ? { platform: 'portal', userId: '42', displayName: 'P' } : null) };
    expect(await resolveIdentity('portal:good', [dev, fake])).toEqual({ platform: 'portal', userId: '42', displayName: 'P' });
    expect(await resolveIdentity('portal:bad', [dev, fake])).toBeNull();
  });
});

describe('account store', () => {
  it('creates an account once per platform identity and keeps the latest display name', () => {
    const s = fresh();
    const a = s.findOrCreate({ platform: 'dev', userId: 'ana', displayName: 'ana' });
    const b = s.findOrCreate({ platform: 'dev', userId: 'ana', displayName: 'Ana' });
    const other = s.findOrCreate({ platform: 'portal', userId: 'ana', displayName: 'Ana' });
    expect(b.id).toBe(a.id);
    expect(b.displayName).toBe('Ana');
    expect(other.id).not.toBe(a.id);
  });

  it('a new account has no save; writing and loading round-trips', () => {
    const s = fresh();
    const a = s.findOrCreate({ platform: 'dev', userId: 'bo', displayName: 'Bo' });
    expect(s.loadSave(a.id)).toBeNull();
    s.writeSave(a.id, '{"x":1}');
    expect(s.loadSave(a.id)).toBe('{"x":1}');
  });
});
