import { describe, expect, it } from 'vitest';
import waterJson from '../../../src/data/water.json';
import { foamMask, isOpenWater, isWaterPixel, parseWaterRules, shoreDistance } from '../../../src/logic/water';

const WATER = [80, 150, 230, 255];
const GRASS = [70, 150, 60, 255];

/** A w x h frame whose leftmost `bank` columns are grass and the rest water. */
function frame(w: number, h: number, bank: number): number[] {
  const px: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px.push(...(x < bank ? GRASS : WATER));
  return px;
}

describe('water rules', () => {
  it('the shipped water.json is valid', () => {
    expect(() => parseWaterRules(waterJson)).not.toThrow();
  });

  it('rejects a crest alpha above 1 and a reversed range', () => {
    const bad = structuredClone(waterJson) as { crests: { alpha: number; lifeMs: number[] } };
    bad.crests.alpha = 2;
    expect(() => parseWaterRules(bad)).toThrow(/crests.alpha/);
    const rev = structuredClone(waterJson) as { crests: { lifeMs: number[] } };
    rev.crests.lifeMs = [3000, 1000];
    expect(() => parseWaterRules(rev)).toThrow(/crests.lifeMs/);
  });
});

describe('open water', () => {
  const corners = ['ggw', 'gww', 'gww'];
  it('needs all four corners to be water', () => {
    expect(isOpenWater(corners, 1, 1)).toBe(true);
    expect(isOpenWater(corners, 0, 0)).toBe(false);
    expect(isOpenWater(corners, 1, 2)).toBe(false); // past the last corner row
  });

  it('tells blue water from grass and transparent pixels', () => {
    expect(isWaterPixel(WATER[0], WATER[1], WATER[2], 255)).toBe(true);
    expect(isWaterPixel(GRASS[0], GRASS[1], GRASS[2], 255)).toBe(false);
    expect(isWaterPixel(WATER[0], WATER[1], WATER[2], 0)).toBe(false);
  });
});

describe('shore foam', () => {
  it('measures distance from the bank, not from the frame edge', () => {
    const w = 8;
    const d = shoreDistance(frame(w, 2, 2), w, 2, 3);
    // columns: 0-1 grass, 2 touches the bank, then 2, 3, capped at max + 1
    expect(Array.from(d.slice(0, w))).toEqual([0, 0, 1, 2, 3, 4, 4, 4]);
  });

  it('a frame of open water has no shore at all', () => {
    const d = shoreDistance(frame(4, 4, 0), 4, 4, 3);
    expect(Array.from(d).every((v) => v === 4)).toBe(true);
  });

  it('keeps only the band, and thins it to a checker when sparse', () => {
    const w = 8;
    const d = shoreDistance(frame(w, 2, 2), w, 2, 5);
    expect(Array.from(foamMask(d, w, [1, 2], false).slice(0, w))).toEqual([0, 0, 1, 1, 0, 0, 0, 0]);
    const sparse = foamMask(d, w, [1, 2], true);
    expect(Array.from(sparse.slice(0, w))).toEqual([0, 0, 1, 0, 0, 0, 0, 0]);
    expect(Array.from(sparse.slice(w, 2 * w))).toEqual([0, 0, 0, 1, 0, 0, 0, 0]);
  });
});
