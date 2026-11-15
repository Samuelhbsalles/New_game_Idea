import { describe, expect, it } from 'vitest';
import ferryJson from '../../../src/data/ferry.json';
import { buyTicket, inBooth, parseFerry } from '../../../src/logic/ferry';

/** A ferry with one open destination and one still coming. */
function rules() {
  return parseFerry({
    fare: 15,
    returnFree: true,
    booth: { x: 100, y: 200, w: 40, h: 20 },
    destinations: [
      { id: 'shore', status: 'open', scene: 'ShoreScene' },
      { id: 'island', status: 'soon' },
    ],
  });
}

describe('ferry', () => {
  it('the shipped ferry.json is valid', () => {
    expect(() => parseFerry(ferryJson)).not.toThrow();
  });

  it('refuses an open destination without a scene, and a negative fare', () => {
    expect(() => parseFerry({ ...ferryJson, destinations: [{ id: 'x', status: 'open' }] })).toThrow(/destinations\[0\]\.scene/);
    expect(() => parseFerry({ ...ferryJson, fare: -1 })).toThrow(/fare/);
  });

  it('a ticket to an open destination costs the fare and names its scene', () => {
    // Arrange
    const wallet = { coins: 20 };
    // Act
    const r = buyTicket(wallet, rules(), 'shore');
    // Assert
    expect(r).toEqual({ ok: true, coins: 5, scene: 'ShoreScene' });
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
