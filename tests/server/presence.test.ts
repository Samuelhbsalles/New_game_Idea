import { describe, expect, it } from 'vitest';
import { MAX_COORD, MAX_LOOK_BYTES, sanitizeLook, sanitizeMove } from '../../server/src/rooms/presence';

describe('presence input checks', () => {
  const ok = { place: 'town', x: 10.6, y: 20, face: 'left', moving: true };

  it('accepts a well-formed move and rounds it to whole pixels', () => {
    expect(sanitizeMove(ok)).toEqual({ place: 'town', x: 11, y: 20, face: 'left', moving: true });
    expect(sanitizeMove({ ...ok, place: 'interior:bakery' })?.place).toBe('interior:bakery');
  });

  it('drops anything malformed instead of half-applying it', () => {
    const bad = [null, 'town', { ...ok, place: '' }, { ...ok, place: '<b>' }, { ...ok, x: -1 }, { ...ok, y: MAX_COORD + 1 }, { ...ok, x: Number.NaN }, { ...ok, face: 'north' }, { ...ok, moving: 'yes' }];
    for (const b of bad) expect(sanitizeMove(b), JSON.stringify(b)).toBeNull();
  });

  it('accepts a small JSON object as a look, nothing else', () => {
    expect(sanitizeLook('{"hair":"bob"}')).toBe('{"hair":"bob"}');
    expect(sanitizeLook('[1]')).toBeNull();
    expect(sanitizeLook('not json')).toBeNull();
    expect(sanitizeLook(`{"x":"${'a'.repeat(MAX_LOOK_BYTES)}"}`)).toBeNull();
  });
});
