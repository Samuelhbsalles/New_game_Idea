import { describe, expect, it } from 'vitest';
import { hexToRgb, nativeFontSize, snapPixels } from '../../../src/scenes/ui/snapPixels';

const px = (...rgba: number[]) => new Uint8ClampedArray(rgba);

describe('snapPixels (crisp pixel text)', () => {
  it('clears faint edge pixels and makes strong ones fully opaque in the fill colour', () => {
    const data = px(250, 250, 250, 100, 240, 230, 220, 200);
    snapPixels(data, [[255, 255, 255]], false);
    expect([...data]).toEqual([250, 250, 250, 0, 255, 255, 255, 255]);
  });

  it('with an opaque background, every pixel takes the nearest of fill and background', () => {
    const fill: [number, number, number] = [244, 233, 211];
    const bg: [number, number, number] = [59, 42, 63];
    const data = px(200, 190, 170, 255, 90, 70, 90, 255);
    snapPixels(data, [fill, bg], true);
    expect([...data]).toEqual([...fill, 255, ...bg, 255]);
  });

  it('parses only #rrggbb colours', () => {
    expect(hexToRgb('#3B2A3F')).toEqual([59, 42, 63]);
    expect(hexToRgb('transparent')).toBeNull();
    expect(hexToRgb(undefined)).toBeNull();
  });

  it('rounds any size to the native size, or twice it for big titles', () => {
    expect(nativeFontSize(9, 16)).toBe(16);
    expect(nativeFontSize(16, 16)).toBe(16);
    expect(nativeFontSize(23, 16)).toBe(16);
    expect(nativeFontSize(24, 16)).toBe(32);
    expect(nativeFontSize(40, 16)).toBe(32);
  });
});
