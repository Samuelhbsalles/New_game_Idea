import { describe, expect, it } from 'vitest';
import interiorsJson from '../../../src/data/interiors.json';
import shopsJson from '../../../src/data/shops.json';
import { formatCountdown, parseInteriors, pieceBlock, stationNear, workPoint, WORK_REACH } from '../../../src/logic/interior';
import { wallRects, exitAt } from '../../../src/logic/room';

const shops = shopsJson.map((s) => ({ id: s.id, slots: s.slots }));

describe('interiors', () => {
  it('parses every building and gives each shop slot a station', () => {
    const all = parseInteriors(interiorsJson, shops);
    expect(Object.keys(all).sort()).toEqual(['bakery', 'cafe', 'careHome', 'clothes', 'construction', 'factory', 'hotel', 'market', 'petPharmacy']);
    for (const def of Object.values(all)) {
      expect(def.stations.length).toBe(shops.find((s) => s.id === def.shopId)!.slots);
      expect(wallRects(def).length).toBeGreaterThan(0);
    }
  });

  it('the doorway leads back to town', () => {
    const bakery = parseInteriors(interiorsJson, shops).bakery;
    expect(exitAt(bakery, { x: 128, y: 250 })?.to).toBe('town');
    expect(exitAt(bakery, { x: 128, y: 150 })).toBeNull();
  });

  it('no worker is hidden behind furniture other than the piece it works at', () => {
    // A worker's body: about 24px wide and 36px tall above its feet.
    for (const def of Object.values(parseInteriors(interiorsJson, shops))) {
      def.stations.forEach((s, i) => {
        const wp = workPoint(s, WORK_REACH);
        for (const p of def.pieces) {
          if (p.foot <= s.y) continue; // drawn behind the worker
          const worksAt = wp.x >= p.x && wp.x < p.x + p.w && wp.y >= p.y && wp.y < p.y + p.h;
          if (worksAt) continue;
          const overlaps = s.x + 12 > p.x && s.x - 12 < p.x + p.w && s.y > p.y && s.y - 36 < p.y + p.h;
          expect(overlaps, `${def.id} station ${i} hidden by piece ${p.n}`).toBe(false);
        }
      });
    }
  });

  it('no station stands inside a piece of furniture', () => {
    for (const def of Object.values(parseInteriors(interiorsJson, shops))) {
      for (const s of def.stations) {
        for (const p of def.pieces) {
          if (!p.block) continue;
          const b = p.block;
          const inside = s.x >= b.x && s.x < b.x + b.w && s.y >= b.y && s.y < b.y + b.h;
          expect(inside, `${def.id} station ${s.x},${s.y} in piece ${p.n}`).toBe(false);
        }
      }
    }
  });

  it('every station faces a piece of furniture it works at', () => {
    for (const def of Object.values(parseInteriors(interiorsJson, shops))) {
      def.stations.forEach((s, i) => {
        const p = workPoint(s, WORK_REACH);
        const onPiece = def.pieces.some((pc) => p.x >= pc.x && p.x < pc.x + pc.w && p.y >= pc.y && p.y < pc.y + pc.h);
        expect(onPiece, `${def.id} station ${i} works at ${p.x},${p.y}`).toBe(true);
      });
    }
  });

  it('rejects a bad facing and a bad effect colour', () => {
    const face = { bakery: { ...interiorsJson.bakery, stations: [{ ...interiorsJson.bakery.stations[0], face: 'north' }, ...interiorsJson.bakery.stations.slice(1)] } };
    expect(() => parseInteriors(face, shops)).toThrow(/face/);
    expect(() => parseInteriors({ bakery: { ...interiorsJson.bakery, effect: { color: 'white', everyMs: 500 } } }, shops)).toThrow(/color/);
  });

  it('rejects a station count that does not match the shop slots', () => {
    const bad = { bakery: { ...interiorsJson.bakery, stations: interiorsJson.bakery.stations.slice(1) } };
    expect(() => parseInteriors(bad, shops)).toThrow(/stations/);
  });

  it('rejects an unknown shop and a station off the floor', () => {
    expect(() => parseInteriors({ bakery: { ...interiorsJson.bakery, shopId: 'nope' } }, shops)).toThrow(/shopId/);
    const off = { bakery: { ...interiorsJson.bakery, stations: [{ x: 2, y: 2, face: 'up' }, ...interiorsJson.bakery.stations.slice(1)] } };
    expect(() => parseInteriors(off, shops)).toThrow(/walkable/);
  });

  it('a piece blocks a strip just above its foot, inset at the sides', () => {
    expect(pieceBlock({ x: 10, w: 40, foot: 100 }, 14, 3)).toEqual({ x: 13, y: 86, w: 34, h: 14 });
  });

  it('finds the closest station in range', () => {
    const bakery = parseInteriors(interiorsJson, shops).bakery;
    const s = bakery.stations[1];
    expect(stationNear(bakery, { x: s.x + 5, y: s.y }, 30)).toBe(1);
    expect(stationNear(bakery, { x: 0, y: 0 }, 30)).toBe(-1);
  });

  it('formats a countdown as m:ss, rounding up', () => {
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(61_001)).toBe('1:02');
    expect(formatCountdown(-5)).toBe('0:00');
  });
});
