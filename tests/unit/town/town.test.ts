import { describe, expect, it } from 'vitest';
import mapJson from '../../../src/data/map.json';
import spritesJson from '../../../src/data/sprites.json';
import shoreJson from '../../../src/data/shore.json';
import townJson from '../../../src/data/town.json';
import { parseMap } from '../../../src/logic/map';
import { buildNavGrid, findPath } from '../../../src/logic/npcMind';
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

  it('a walkway (pier) makes the water tiles it fully covers walkable, and only those', () => {
    // Arrange: the pier covers the water tile of row 1 only.
    const r = { ...raw(), walkways: [{ x: 96, y: 32, w: 32, h: 32 }] };
    // Act
    const town = parseTown(r);
    const solids = townSolids(town);
    // Assert: water runs left in rows 0 and 2, none in row 1.
    const water = solids.filter((s) => s.x === 96 && s.w === 32);
    expect(water.map((s) => s.y)).toEqual([0, 64]);
    expect(solids.some((s) => contains(s, { x: 110, y: 48 }))).toBe(false);
  });

  it('flat props and bobbing props are parsed; a negative bob is refused', () => {
    const r = raw();
    (r.props as unknown[]).push({ sprite: 'pier', x: 100, y: 60, solid: null, flat: true }, { sprite: 'boat', x: 110, y: 90, solid: null, bob: 1 });
    const town = parseTown(r);
    expect(town.props[1].flat).toBe(true);
    expect(town.props[2].bob).toBe(1);
    (r.props as { bob?: number }[])[2].bob = -1;
    expect(() => parseTown(r)).toThrow(/props\[2\]/);
  });

  it('a prop can cast a ground shadow; a shadow without a size is refused', () => {
    const r = raw();
    (r.props as unknown[]).push({ sprite: 'hut', x: 50, y: 60, solid: null, shadow: { w: 40, h: 10, dy: -2 } });
    expect(parseTown(r).props[1].shadow).toEqual({ w: 40, h: 10, dy: -2 });
    (r.props as { shadow?: unknown }[])[1].shadow = { dy: 0 };
    expect(() => parseTown(r)).toThrow(/props\[1\]\.shadow/);
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

  it('rejects an NPC whose home or favourite is not a building', () => {
    const npc = { art: 'a', speed: 10, home: 'home', favorites: ['home'], weights: { visit: 1, home: 1, stroll: 1, idle: 1 }, insideMs: [1, 2], idleMs: [1, 2], temper: 2 };
    expect(() => parseTown({ ...raw(), npcs: [{ ...npc, home: 'castle' }] })).toThrow(/npcs\[0\]\.home/);
    expect(() => parseTown({ ...raw(), npcs: [{ ...npc, favorites: ['moon'] }] })).toThrow(/npcs\[0\]\.favorites\[0\]/);
  });

  it('shipped town: every NPC can walk from its home door to each favourite door', () => {
    const town = parseTown(townJson);
    const nav = buildNavGrid(town.cols * town.tileSize, town.rows * town.tileSize, 16, townSolids(town), 6);
    expect(town.npcs.length).toBeGreaterThan(0);
    for (const n of town.npcs) {
      const from = arrivalPoint(town, n.home)!;
      for (const f of n.favorites) {
        const to = arrivalPoint(town, f)!;
        expect(findPath(nav, from, to).length, `${n.art}: ${n.home} -> ${f}`).toBeGreaterThan(0);
      }
    }
  });

  it('shipped town: the bird landing area is open ground inside the plaza', () => {
    const town = parseTown(townJson);
    const L = town.birds!.landing;
    const blockers = townSolids({ ...town, props: [] });
    for (const p of [{ x: L.x, y: L.y }, { x: L.x + L.w, y: L.y + L.h }, { x: L.x + L.w / 2, y: L.y + L.h / 2 }]) {
      expect(blockers.some((s) => contains(s, p))).toBe(false);
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

  it('shipped shore map: valid, the dock arrival is free, and the ferry back is reachable from it', () => {
    const shore = parseTown(shoreJson);
    const solids = townSolids(shore);
    const dock = arrivalPoint(shore, 'dock')!;
    expect(dock).not.toBeNull();
    expect(solids.some((b) => contains(b, dock))).toBe(false);
    expect(shore.ferryBack).not.toBeNull();
    expect(contains(shore.ferryBack!, dock)).toBe(true);
  });
});

