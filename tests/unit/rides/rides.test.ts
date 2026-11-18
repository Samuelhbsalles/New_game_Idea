import { describe, expect, it } from 'vitest';
import ridesJson from '../../../src/data/rides.json';
import { deserialize, SAVE_VERSION } from '../../../src/logic/state';
import { buyRide, currentRide, parseRides, rideLift, speedFactor, toggleRide, type RideWallet } from '../../../src/logic/rides';

/** A shop with one ride for sale and one coming soon. */
function rules() {
  return parseRides({
    rides: [
      { id: 'skate', price: 120, speedBonus: 0.3, status: 'open', roughFactor: 0.8, look: { over: false, dy: 6, bobPx: 1, bobMs: 800 } },
      { id: 'bike', price: 450, speedBonus: 0.8, status: 'soon', roughFactor: 0.9 },
    ],
  });
}

describe('rides config', () => {
  it('the shipped rides.json is valid', () => {
    expect(() => parseRides(ridesJson)).not.toThrow();
  });

  it('refuses a duplicate id, a zero speed bonus and an unknown status', () => {
    expect(() => parseRides({ rides: [ridesJson.rides[0], ridesJson.rides[0]] })).toThrow(/listed twice/);
    expect(() => parseRides({ rides: [{ id: 'x', price: 1, speedBonus: 0, status: 'open' }] })).toThrow(/speedBonus/);
    expect(() => parseRides({ rides: [{ id: 'x', price: 1, speedBonus: 0.2, status: 'later' }] })).toThrow(/status/);
    expect(() => parseRides({ rides: [{ id: 'x', price: 1, speedBonus: 0.2, status: 'soon', roughFactor: 1.5 }] })).toThrow(/roughFactor/);
  });

  it('needs a look with a bob for a ride on sale', () => {
    expect(() => parseRides({ rides: [{ id: 'x', price: 1, speedBonus: 0.2, status: 'open', roughFactor: 0.8 }] })).toThrow(/look/);
    expect(() => parseRides({ rides: [{ id: 'x', price: 1, speedBonus: 0.2, status: 'open', roughFactor: 0.8, look: { over: false, dy: 0 } }] })).toThrow(/bobPx/);
  });
});

describe('buying a ride', () => {
  it('takes the price and adds the ride to those owned', () => {
    // Arrange
    const wallet: RideWallet = { coins: 150 };
    // Act
    const r = buyRide(wallet, rules(), 'skate');
    // Assert
    expect(r).toEqual({ ok: true, coins: 30 });
    expect(wallet.rides).toEqual(['skate']);
  });

  it('refuses without enough coins, a second copy, a ride not on sale yet, and an unknown id — charging nothing', () => {
    const poor: RideWallet = { coins: 119 };
    expect(buyRide(poor, rules(), 'skate')).toEqual({ ok: false, reason: 'no_coins' });
    const owner: RideWallet = { coins: 500, rides: ['skate'] };
    expect(buyRide(owner, rules(), 'skate')).toEqual({ ok: false, reason: 'owned' });
    expect(buyRide(owner, rules(), 'bike')).toEqual({ ok: false, reason: 'soon' });
    expect(buyRide(owner, rules(), 'jetpack')).toEqual({ ok: false, reason: 'unknown' });
    expect(poor.coins).toBe(119);
    expect(owner.coins).toBe(500);
  });
});

describe('riding', () => {
  it('gets on an owned ride and off it again', () => {
    const wallet: RideWallet = { coins: 0, rides: ['skate'] };
    expect(toggleRide(wallet, 'skate')).toBe('skate');
    expect(wallet.riding).toBe('skate');
    expect(toggleRide(wallet, 'skate')).toBeNull();
    expect(wallet.riding).toBeUndefined();
  });

  it('swaps to another owned ride, and refuses one not owned', () => {
    const wallet: RideWallet = { coins: 0, rides: ['skate', 'rollers'], riding: 'skate' };
    expect(toggleRide(wallet, 'rollers')).toBe('rollers');
    expect(toggleRide(wallet, 'bike')).toBe('not_owned');
    expect(wallet.riding).toBe('rollers');
  });

  it('walks at 1x on foot and goes faster on a ride on paved ground', () => {
    expect(speedFactor({ coins: 0 }, rules())).toBe(1);
    expect(speedFactor({ coins: 0, rides: ['skate'], riding: 'skate' }, rules(), 'paved')).toBeCloseTo(1.3);
  });

  it('slows a ride below walking speed on grass or sand, but not someone on foot', () => {
    expect(speedFactor({ coins: 0, rides: ['skate'], riding: 'skate' }, rules(), 'rough')).toBeCloseTo(0.8);
    expect(speedFactor({ coins: 0 }, rules(), 'rough')).toBe(1);
  });

  it('ignores a ride in the save that is not owned or not for sale', () => {
    expect(currentRide({ coins: 0, riding: 'skate' }, rules())).toBeNull();
    expect(currentRide({ coins: 0, rides: ['bike'], riding: 'bike' }, rules())).toBeNull();
  });
});

describe('rides in the save', () => {
  const base = { saveVersion: SAVE_VERSION, coins: 0, inventory: {}, creatures: [], shifts: [] };

  it('keeps the rides owned and the one in use', () => {
    const back = deserialize(JSON.stringify({ ...base, rides: ['skate'], riding: 'skate' }));
    expect(back?.rides).toEqual(['skate']);
    expect(back?.riding).toBe('skate');
  });

  it('rejects a save whose rides are not a list of names', () => {
    expect(deserialize(JSON.stringify({ ...base, rides: 'skate' }))).toBeNull();
    expect(deserialize(JSON.stringify({ ...base, riding: 3 }))).toBeNull();
  });
});

describe('gliding on a ride', () => {
  const look = { over: false, dy: 6, bobPx: 1, bobMs: 800 };

  it('bobs smoothly up and back down while moving', () => {
    expect(rideLift(look, true, 0)).toBe(0);
    expect(rideLift(look, true, 400)).toBe(1);
    expect(rideLift(look, true, 800)).toBe(0);
  });

  it('stays level when stopped', () => {
    expect(rideLift(look, false, 400)).toBe(0);
  });
});
