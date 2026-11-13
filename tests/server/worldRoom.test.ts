// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ColyseusTestServer } from '@colyseus/testing';
import creatures from '../../src/data/creatures.json';
import items from '../../src/data/items.json';
import shops from '../../src/data/shops.json';
import start from '../../src/data/start.json';
import time from '../../src/data/time.json';
import { createFakeClock } from '../../src/logic/clock';
import { parseConfig } from '../../src/logic/config';
import { newGame, serialize } from '../../src/logic/state';
import { AccountStore } from '../../server/src/db/accounts';
import { DevIdentityProvider } from '../../server/src/identity/devIdentity';
import type { WorldState } from '../../server/src/rooms/presence';
import type { LoadReply, SaveReply } from '../../server/src/rooms/WorldRoom';
import { configureWorld } from '../../server/src/world';

const config = parseConfig({ species: creatures, shops, items, start, time });
const aSave = () => serialize(newGame(config, createFakeClock(1_700_000_000_000)));

let colyseus: ColyseusTestServer;
let accounts: AccountStore;

beforeAll(async () => {
  process.env.WORLD_DB = ':memory:';
  const { boot } = await import('@colyseus/testing');
  const { server } = await import('../../server/src/app');
  // boot(server) always listens on 2568 (testing ignores the port for a Server), so all
  // integration tests that need a live server live in this one file.
  colyseus = await boot(server);
});
afterAll(async () => colyseus?.shutdown());
beforeEach(async () => {
  await colyseus.cleanup();
  accounts?.close();
  accounts = new AccountStore(':memory:');
  configureWorld({ accounts, providers: [new DevIdentityProvider()] });
});

/** Waits (up to 2 s) for a condition on synced state to hold. */
async function until(cond: () => boolean, ms = 2000): Promise<void> {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('condition not met in time');
    await new Promise((r) => setTimeout(r, 20));
  }
}

/** Joins the world as `name` (dev login). */
async function join(name: string) {
  colyseus.sdk.auth.token = `dev:${name}`;
  const room = await colyseus.sdk.joinOrCreate('world');
  await room.waitForInitialState();
  return room;
}

describe('world room (phase 1: accounts and saves on the server)', () => {
  it('a new player gets an account with no save', async () => {
    const room = await join('Ana');
    const reply = (await room.request('load')) as LoadReply;
    expect(reply).toEqual({ displayName: 'Ana', save: null });
  });

  it('a save sent by the client comes back on the next login', async () => {
    const save = aSave();
    const first = await join('Bo');
    expect((await first.request('save', save)) as SaveReply).toEqual({ ok: true });
    await first.leave();
    const again = await join('bo'); // same account: names are case-insensitive
    expect(((await again.request('load')) as LoadReply).save).toBe(save);
  });

  it('refuses a save the game could not load', async () => {
    const room = await join('Cy');
    expect(await room.request('save', '{"not":"a save"}')).toEqual({ ok: false, reason: 'invalid' });
    expect(await room.request('save', 42)).toEqual({ ok: false, reason: 'invalid' });
    expect(((await room.request('load')) as LoadReply).save).toBeNull();
  });

  it('imports the browser save once, into an empty account only', async () => {
    const room = await join('Di');
    const browserSave = aSave();
    expect(await room.request('import', browserSave)).toEqual({ ok: true });
    expect(await room.request('import', aSave())).toEqual({ ok: false, reason: 'exists' });
    expect(((await room.request('load')) as LoadReply).save).toBe(browserSave);
  });

  it('rejects a join without a valid token', async () => {
    colyseus.sdk.auth.token = 'dev:<x>';
    await expect(colyseus.sdk.joinOrCreate('world')).rejects.toBeTruthy();
  });
});

describe('players see each other (phase 2)', () => {
  it('a player who moves shows up, with their name, place and look, for another player', async () => {
    const ana = await join('Ana');
    const bo = await join('Bo');
    ana.send('look', '{"hair":"bob"}');
    ana.send('move', { place: 'town', x: 100, y: 200, face: 'right', moving: true });
    await until(() => (bo.state as WorldState).players.get(ana.sessionId)?.place === 'town');
    const seen = (bo.state as WorldState).players.get(ana.sessionId);
    expect(seen).toMatchObject({ name: 'Ana', place: 'town', x: 100, y: 200, face: 'right', moving: true, look: '{"hair":"bob"}' });
  });

  it('a bad move changes nothing', async () => {
    const ana = await join('Ana');
    const bo = await join('Bo');
    ana.send('move', { place: 'town', x: 5, y: 5, face: 'down', moving: false });
    ana.send('move', { place: 'town', x: -50, y: 5, face: 'down', moving: false });
    ana.send('move', { place: 'marker', x: 5, y: 5, face: 'down', moving: false }); // sent after the bad one
    await until(() => (bo.state as WorldState).players.get(ana.sessionId)?.place === 'marker');
    expect((bo.state as WorldState).players.get(ana.sessionId)).toMatchObject({ x: 5, y: 5 });
  });

  it('a player who leaves disappears for the others', async () => {
    const ana = await join('Ana');
    const bo = await join('Bo');
    await until(() => (bo.state as WorldState).players.has(ana.sessionId));
    await ana.leave();
    await until(() => !(bo.state as WorldState).players.has(ana.sessionId));
    expect((bo.state as WorldState).players.has(ana.sessionId)).toBe(false);
  });
});
