import { describe, expect, it } from 'vitest';
import ferryJson from '../../../src/data/ferry.json';
import { buyTicket, clerkGreets, inBooth, parseFerry } from '../../../src/logic/ferry';

/** A ferry with one open destination and one still coming. */
function rules() {
  return parseFerry({
    fare: 15,
    returnFree: true,
    booth: { x: 100, y: 200, w: 40, h: 20 },
    destinations: [
      { id: 'shore', status: 'open', map: 'shore' },
      { id: 'island', status: 'soon' },
    ],
    clerk: { greetRadius: 60, leaveRadius: 110, waveFps: 8, farewellMs: 900 },
  });
}

describe('ferry', () => {
  it('the shipped ferry.json is valid', () => {
    expect(() => parseFerry(ferryJson)).not.toThrow();
  });

  it('refuses an open destination without a map, and a negative fare', () => {
    expect(() => parseFerry({ ...ferryJson, destinations: [{ id: 'x', status: 'open' }] })).toThrow(/destinations\[0\]\.map/);
    expect(() => parseFerry({ ...ferryJson, fare: -1 })).toThrow(/fare/);
  });

  it('a ticket to an open destination costs the fare and names its map', () => {
    // Arrange
    const wallet = { coins: 20 };
    // Act
    const r = buyTicket(wallet, rules(), 'shore');
    // Assert
    expect(r).toEqual({ ok: true, coins: 5, map: 'shore' });
    expect(wallet.coins).toBe(5);
  });

  it('charges nothing when the trip cannot happen', () => {
    const wallet = { coins: 10 };
    expect(buyTicket(wallet, rules(), 'shore')).toEqual({ ok: false, reason: 'no_coins' });
    expect(buyTicket(wallet, rules(), 'island')).toEqual({ ok: false, reason: 'soon' });
    expect(buyTicket(wallet, rules(), 'moon')).toEqual({ ok: false, reason: 'unknown' });
    expect(wallet.coins).toBe(10);
  });

  it('the exact fare is enough', () => {
    const wallet = { coins: 15 };
    expect(buyTicket(wallet, rules(), 'shore').ok).toBe(true);
    expect(wallet.coins).toBe(0);
  });

  it('knows when the player stands at the booth', () => {
    const r = rules();
    expect(inBooth(r, { x: 100, y: 200 })).toBe(true);
    expect(inBooth(r, { x: 139, y: 219 })).toBe(true);
    expect(inBooth(r, { x: 140, y: 200 })).toBe(false);
  });
});

describe('ferry clerk', () => {
  const c = rules().clerk;

  it('greets once when the player comes close', () => {
    expect(clerkGreets(false, c.greetRadius, c)).toEqual({ greeted: true, greetNow: true });
    expect(clerkGreets(true, c.greetRadius - 10, c)).toEqual({ greeted: true, greetNow: false });
  });

  it('does not greet from further away', () => {
    expect(clerkGreets(false, c.greetRadius + 1, c)).toEqual({ greeted: false, greetNow: false });
  });

  it('is ready to greet again only after the player has walked past leaveRadius', () => {
    expect(clerkGreets(true, c.leaveRadius, c).greeted).toBe(true);
    expect(clerkGreets(true, c.leaveRadius + 1, c)).toEqual({ greeted: false, greetNow: false });
  });

  it('refuses a leave radius smaller than the greet radius', () => {
    expect(() => parseFerry({ ...ferryJson, clerk: { greetRadius: 80, leaveRadius: 40, waveFps: 8, farewellMs: 0 } })).toThrow(/clerk\.leaveRadius/);
  });
});
