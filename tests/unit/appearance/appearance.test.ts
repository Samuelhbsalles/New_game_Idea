import { describe, expect, it } from 'vitest';
import cosmeticsJson from '../../../src/data/cosmetics.json';
import { choices, composeFrame, cycle, defaultAppearance, hexToRgb, hslToRgb, isSkin, isValidAppearance, medianLuma, parseCosmetics, rgbToHsl } from '../../../src/logic/appearance';

const cat = parseCosmetics(cosmeticsJson);

/** A 1-pixel RGBA buffer. */
const px = (r: number, g: number, b: number, a = 255) => new Uint8ClampedArray([r, g, b, a]);

describe('appearance catalog', () => {
  it('parses the shipped catalog with starters in every slot', () => {
    for (const s of ['body', 'hair', 'top', 'bottom'] as const) expect(choices(cat, s).length).toBeGreaterThan(0);
  });

  it('offers only starters until something is owned', () => {
    const tops = choices(cat, 'top').map((t) => t.id);
    expect(tops).not.toContain('top_jacket');
    expect(choices(cat, 'top', ['top_jacket']).map((t) => t.id)).toContain('top_jacket');
  });

  it('builds a valid default appearance', () => {
    expect(isValidAppearance(defaultAppearance(cat), cat)).toBe(true);
  });

  it('rejects unknown parts, unowned shop items, wrong slots and colours out of range', () => {
    const ok = defaultAppearance(cat);
    expect(isValidAppearance({ ...ok, hair: 'hair_mohawk' }, cat)).toBe(false);
    expect(isValidAppearance({ ...ok, top: 'top_jacket' }, cat)).toBe(false);
    expect(isValidAppearance({ ...ok, top: 'top_jacket' }, cat, ['top_jacket'])).toBe(true);
    expect(isValidAppearance({ ...ok, top: 'hair_short' }, cat)).toBe(false);
    expect(isValidAppearance({ ...ok, skin: cat.skinTones.length }, cat)).toBe(false);
    expect(isValidAppearance({ ...ok, hairColor: -1 }, cat)).toBe(false);
    expect(isValidAppearance(null, cat)).toBe(false);
  });

  it('rejects a catalog with no starter for a slot', () => {
    const raw = { ...cosmeticsJson, items: cosmeticsJson.items.filter((i) => i.slot !== 'hair') };
    expect(() => parseCosmetics(raw)).toThrow(/no starter item for slot "hair"/);
  });

  it('cycles through a list with wrap-around both ways', () => {
    expect(cycle(['a', 'b', 'c'], 'c', 1)).toBe('a');
    expect(cycle(['a', 'b', 'c'], 'a', -1)).toBe('c');
  });
});

describe('frame composition', () => {
  it('treats the base skin as skin and the shoes and shirt as not skin', () => {
    expect(isSkin(...hexToRgb('#f4c18c'))).toBe(true);
    expect(isSkin(...hexToRgb('#c88a68'))).toBe(true);
    expect(isSkin(...hexToRgb('#7c533e'))).toBe(false); // shoe
    expect(isSkin(...hexToRgb('#f0efef'))).toBe(false); // white tee
  });

  const near = (a: number[], b: number[], tol = 3) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
  const lightness = (c: number[]) => rgbToHsl(c[0], c[1], c[2])[2];

  it('round-trips colours through HSL', () => {
    for (const hex of ['#c94f4f', '#4f86c6', '#f2efe8', '#2a1d17']) expect(near(hslToRgb(...rgbToHsl(...hexToRgb(hex))), hexToRgb(hex), 1)).toBe(true);
  });

  it('recolours the base mid skin tone to exactly the chosen tone and leaves the white tee alone', () => {
    const body = new Uint8ClampedArray([...px(...hexToRgb('#f4c18c')), ...px(240, 239, 239)]);
    const out = composeFrame(body, { from: '#f4c18c', to: '#5e3a26' }, []);
    expect(near([out[0], out[1], out[2]], hexToRgb('#5e3a26'))).toBe(true);
    expect([out[4], out[5], out[6]]).toEqual([240, 239, 239]);
  });

  it('regression: pale skin highlights follow a dark skin tone instead of staying near-white', () => {
    // A light pink highlight from the base face; before the fix it was not detected as skin.
    const highlight = hexToRgb('#f6dccf');
    expect(isSkin(...highlight)).toBe(true);
    const out = composeFrame(new Uint8ClampedArray(px(...highlight)), { from: '#f4c18c', to: '#5e3a26' }, []);
    expect(lightness([out[0], out[1], out[2]])).toBeLessThan(0.5);
  });

  it('tints a layer so its mid tone becomes the colour and keeps transparent pixels see-through', () => {
    const body = new Uint8ClampedArray([...px(240, 239, 239), ...px(240, 239, 239)]);
    const layer = new Uint8ClampedArray([...px(100, 100, 100), ...px(0, 0, 0, 0)]);
    const out = composeFrame(body, { from: '#f4c18c', to: '#f4c18c' }, [{ px: layer, color: '#c94f4f', mid: 100 }]);
    expect(near([out[0], out[1], out[2]], hexToRgb('#c94f4f'))).toBe(true);
    expect([out[4], out[5], out[6]]).toEqual([240, 239, 239]);
  });

  it('keeps shading without blowing out: lighter stays lighter but never turns white, darker never turns black', () => {
    const target = hexToRgb('#e8d06a');
    const bright = composeFrame(new Uint8ClampedArray(px(0, 0, 0, 0)), { from: '#f4c18c', to: '#f4c18c' }, [{ px: px(255, 255, 255), color: '#e8d06a', mid: 120 }]);
    const dark = composeFrame(new Uint8ClampedArray(px(0, 0, 0, 0)), { from: '#f4c18c', to: '#f4c18c' }, [{ px: px(10, 10, 10), color: '#e8d06a', mid: 120 }]);
    expect(lightness([bright[0], bright[1], bright[2]])).toBeGreaterThan(lightness(target));
    expect(lightness([bright[0], bright[1], bright[2]])).toBeLessThanOrEqual(0.9 + 0.01);
    expect(lightness([dark[0], dark[1], dark[2]])).toBeLessThan(lightness(target));
    expect(lightness([dark[0], dark[1], dark[2]])).toBeGreaterThanOrEqual(0.06 - 0.01);
  });

  it('finds the median brightness of opaque pixels only', () => {
    const buf = new Uint8ClampedArray([...px(10, 10, 10), ...px(200, 200, 200), ...px(100, 100, 100), ...px(255, 255, 255, 0)]);
    expect(medianLuma(buf)).toBeCloseTo(100);
  });
});
