import { describe, expect, it } from 'vitest';
import mapJson from '../../../src/data/map.json';
import spritesJson from '../../../src/data/sprites.json';
import townJson from '../../../src/data/town.json';
import { parseMap } from '../../../src/logic/map';
import { arrivalPoint, doorAt, doorBox, paintCorners, parseTown, tileFlip, townLayers, townSolids, type Box } from '../../../src/logic/town';

const WANG = [6, 7, 10, 9, 2, 11, 4, 15, 5, 14, 1, 8, 3, 0, 13, 12];

// 4x3 tiles, all grass, a 1-tile cobble square at tile (1,1) and water at the right edge.
function raw() {
  return {
    tileSize: 32,
    cols: 4,
    rows: 3,
    terrain: {
      fill: 'g',
      rects: [
        { t: 'c', x: 1, y: 1, w: 2, h: 2 },
        { t: 'w', x: 4, y: 0, w: 1, h: 4 },
      ],
    },
    ground: { key: 'ground', wangToFrame: WANG },
    water: { key: 'water', wangToFrame: WANG },
    buildings: [{ id: 'home', sprite: 'h', x: 64, y: 32, doorDx: 4, solid: { w: 40, h: 20 } }],
    props: [{ sprite: 'p', x: 16, y: 96, solid: null }],
    spots: { park: { x: 16, y: 80 } },
    spawn: { x: 64, y: 60 },
  };
}

const contains = (b: Box, p: { x: number; y: number }) => p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h;

describe('town', () => {
  it('paints rects over the fill, later rects winning, clipped to the grid', () => {
    const c = paintCorners(3, 2, 'g', [
      { t: 'c', x: 0, y: 0, w: 2, h: 2 },
      { t: 'w', x: 1, y: 1, w: 9, h: 9 },
    ]);
    expect(c).toEqual(['ccgg', 'cwww', 'gwww']);
  });

  it('builds ground frames with cobble as lower and water frames only where water touches', () => {
    const town = parseTown(raw());
    const { ground, water } = townLayers(town);
    // Tile (1,1) has all four corners cobble -> Wang 0.
    expect(ground[1][1]).toBe(WANG[0]);
    // Tile (0,0) is grass but its SE corner is the cobble square's -> NW+NE+SW = 14.
    expect(ground[0][0]).toBe(WANG[14]);
    // Only the last column touches water; its right corners are water (lower) -> NW+SW grass = 8+2.
    expect(water.map((r) => r.slice(0, 3).every((f) => f === -1))).toEqual([true, true, true]);
    expect(water[0][3]).toBe(WANG[10]);
  });

  it('rejects a tile where cobble meets water', () => {
    const r = raw();
    r.terrain.rects.push({ t: 'c', x: 3, y: 0, w: 1, h: 1 });
    expect(() => parseTown(r)).toThrow(/cobble meets water at tile \(2, 0\)|cobble meets water at tile \(3, 0\)/);
  });

  it('makes water tiles, building and prop footprints solid', () => {
    const town = parseTown(raw());
    const solids = townSolids(town);
    // Water run: column 3 of every row.
    expect(solids.filter((s) => s.x === 96 && s.w === 32)).toHaveLength(3);
    // Building footprint ends on its foot line, centred on x.
    expect(solids).toContainEqual({ x: 44, y: 12, w: 40, h: 20 });
    // The prop without a footprint adds nothing.
    expect(solids).toHaveLength(4);
  });

  it('finds a door only inside the strip under it', () => {
    const town = parseTown(raw());
    const d = doorBox(town.buildings[0]);
    expect(doorAt(town, { x: d.x + 1, y: d.y + 1 })?.id).toBe('home');
    expect(doorAt(town, { x: d.x + 1, y: d.y - 1 })).toBeNull();
    expect(doorAt(town, { x: d.x + d.w + 1, y: d.y + 1 })).toBeNull();
  });

  it('arrives below a building door, at a named spot, or nowhere for an unknown place', () => {
    const town = parseTown(raw());
    const a = arrivalPoint(town, 'home')!;
    expect(a.x).toBe(68);
    expect(a.y).toBeGreaterThan(32);
    expect(arrivalPoint(town, 'park')).toEqual({ x: 16, y: 80 });
    expect(arrivalPoint(town, 'moon')).toBeNull();
  });

  it('shipped town: every map place has a free arrival point, and spawn and doors are clear', () => {
    const town = parseTown(townJson);
    const map = parseMap(mapJson);
    const solids = townSolids(town);
    const free = (p: { x: number; y: number }) => !solids.some((s) => contains(s, p));
    for (const place of map.places) {
      const a = arrivalPoint(town, place.id);
      expect(a, place.id).not.toBeNull();
      expect(free(a!), place.id).toBe(true);
    }
    expect(free(town.spawn)).toBe(true);
    for (const b of town.buildings) {
      const d = doorBox(b);
      expect(free({ x: d.x + d.w / 2, y: d.y + d.h / 2 }), b.id).toBe(true);
    }
  });

  it('mirrors full tiles the same way every time, and not all the same way', () => {
    expect(tileFlip(3, 7)).toEqual(tileFlip(3, 7));
    const flips = new Set<string>();
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) flips.add(JSON.stringify(tileFlip(x, y)));
    expect(flips.size).toBeGreaterThan(1);
  });

  it('shipped town: every NPC has art in sprites.json', () => {
    const town = parseTown(townJson);
    for (const n of town.npcs) expect(Object.keys(spritesJson), n.art).toContain(n.art);
  });

  it('rejects an NPC route with fewer than two points', () => {
    expect(() => parseTown({ ...raw(), npcs: [{ art: 'a', route: [{ x: 1, y: 1 }], speed: 10, pauseMs: [0, 1] }] })).toThrow(/npcs\[0\]\.route/);
  });

  it('shipped town: every NPC route segment stays clear of buildings and water', () => {
    const town = parseTown(townJson);
    // Water runs and building footprints; small props (lamps, bushes) only get brushed past.
    const blockers = townSolids({ ...town, props: [] });
    expect(town.npcs.length).toBeGreaterThan(0);
    for (const n of town.npcs) {
      for (let i = 0; i < n.route.length; i++) {
        const a = n.route[i];
        const b = n.route[(i + 1) % n.route.length];
        for (let k = 0; k <= 20; k++) {
          const p = { x: a.x + ((b.x - a.x) * k) / 20, y: a.y + ((b.y - a.y) * k) / 20 };
          expect(blockers.some((s) => contains(s, p)), `${n.art} at ${Math.round(p.x)},${Math.round(p.y)}`).toBe(false);
        }
      }
    }
  });

  it('shipped town: buildings and solid props do not overlap each other', () => {
    const town = parseTown(townJson);
    const solids = townSolids(town).filter((s) => !(s.w % 32 === 0 && s.h === 32 && s.x >= 1408)); // skip water runs
    const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    for (let i = 0; i < solids.length; i++) {
      for (let j = i + 1; j < solids.length; j++) expect(overlap(solids[i], solids[j]), `${JSON.stringify(solids[i])} vs ${JSON.stringify(solids[j])}`).toBe(false);
    }
  });
});
