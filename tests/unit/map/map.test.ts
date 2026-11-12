import { describe, expect, it } from 'vitest';
import mapJson from '../../../src/data/map.json';
import { navigate, parseMap, type Place } from '../../../src/logic/map';

// A plus-shaped fixture: centre C with N/S/E/W neighbours, plus a far corner F.
function places(): Place[] {
  return [
    { id: 'C', x: 100, y: 100, status: 'open', scene: 'S' },
    { id: 'N', x: 100, y: 50, status: 'soon' },
    { id: 'S', x: 100, y: 150, status: 'soon' },
    { id: 'E', x: 160, y: 104, status: 'soon' },
    { id: 'W', x: 40, y: 96, status: 'soon' },
    { id: 'F', x: 125, y: 20, status: 'soon' },
  ];
}

function raw() {
  return { background: 'bg', width: 200, height: 200, start: 'C', places: places() };
}

describe('town map', () => {
  it('parses the shipped map.json with home open and the bible shops present', () => {
    const map = parseMap(mapJson);
    const ids = map.places.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['home', 'bakery', 'cafe', 'market', 'factory', 'hotel', 'construction', 'clothes', 'petPharmacy', 'careHome']));
    expect(map.places.find((p) => p.id === 'home')).toMatchObject({ status: 'open', scene: 'HomeScene' });
  });

  it('moves to the neighbour straight in the pressed direction', () => {
    expect(navigate(places(), 'C', 'up')).toBe('N');
    expect(navigate(places(), 'C', 'down')).toBe('S');
    expect(navigate(places(), 'C', 'right')).toBe('E');
    expect(navigate(places(), 'C', 'left')).toBe('W');
  });

  it('prefers the on-axis place over a diagonal one when going up', () => {
    // F is further up but off to the side; N is straight above.
    expect(navigate(places(), 'C', 'up')).toBe('N');
    // From N, the only place further up is F (25 right, 30 up) — within the cone.
    expect(navigate(places(), 'N', 'up')).toBe('F');
  });

  it('stays put when nothing lies in that direction', () => {
    expect(navigate(places(), 'S', 'down')).toBe('S');
    expect(navigate(places(), 'W', 'left')).toBe('W');
  });

  it('rejects an open place without a scene', () => {
    const r = raw();
    delete r.places[0].scene;
    expect(() => parseMap(r)).toThrow(/places\[0\]\.scene/);
  });

  it('rejects duplicate ids, an unknown start and a place off the picture', () => {
    expect(() => parseMap({ ...raw(), places: [...places(), places()[1]] })).toThrow(/duplicate id "N"/);
    expect(() => parseMap({ ...raw(), start: 'Z' })).toThrow(/unknown place "Z"/);
    expect(() => parseMap({ ...raw(), width: 120 })).toThrow(/must lie on the map picture/);
  });
});
