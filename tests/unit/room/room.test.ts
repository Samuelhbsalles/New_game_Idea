import { describe, expect, it } from 'vitest';
import furniture from '../../../src/data/furniture.json';
import home from '../../../src/data/home.json';
import { buildFloorGrid, exitAt, findUseSpot, parseCatalog, parseRoom, solidRects, wallRects } from '../../../src/logic/room';

const catalog = parseCatalog(furniture);

function petFixture() {
  return {
    creatureId: 'c1',
    x: 48,
    y: 48,
    speed: 40,
    walkFps: 8,
    foodItemId: 'food',
    followDistance: 20,
    tuning: {
      durations: { idle: [1, 2], wander: [1, 2], eat: [1, 2], sleep: [1, 2], lounge: [1, 2], askPet: [1, 2], petted: [1, 1] },
      weights: { idle: 1, wander: 1, eat: 1, sleep: 1, lounge: 1, askPet: 1 },
    },
  };
}

// Small fixture: a 64x64 picture, 16px grid, a 32x32 floor in the middle and a
// one-cell doorway below it, which is the exit.
function fixtureRaw() {
  return {
    background: 'pic',
    width: 64,
    height: 64,
    gridSize: 16,
    walkable: [
      { x: 16, y: 16, w: 32, h: 32 },
      { x: 16, y: 48, w: 16, h: 16 },
    ],
    exits: [{ to: 'map', rect: { x: 16, y: 48, w: 16, h: 16 }, arrive: { x: 24, y: 40 } }],
    placements: [{ item: 'sofa', x: 100, y: 50 }],
    player: { character: 'player', x: 48, y: 48, speed: 90, walkFps: 8, interactRange: 40 },
    pet: petFixture(),
  };
}

describe('room layout', () => {
  it('parses the shipped furniture catalog and home.json', () => {
    const room = parseRoom(home, catalog);
    expect(room.walkable.length).toBeGreaterThan(0);
    expect(room.furniture.length).toBeGreaterThan(0);
  });

  it('pet floor grid marks whole walkable cells only, leaving out exit cells', () => {
    // Arrange
    const room = parseRoom(fixtureRaw(), catalog);
    // Act
    const grid = buildFloorGrid(room);
    // Assert: 4x4 cells; the 2x2 middle is floor; the doorway cell (1,3) is an exit, not floor
    expect(grid.length).toBe(4);
    expect(grid[0].length).toBe(4);
    expect(grid.flat().filter(Boolean).length).toBe(4);
    expect(grid[1][1] && grid[1][2] && grid[2][1] && grid[2][2]).toBe(true);
    expect(grid[3][1]).toBe(false);
  });

  it('wall rects cover exactly the non-walkable cells, one rect per run in a row', () => {
    const room = parseRoom(fixtureRaw(), catalog);
    const walls = wallRects(room);
    // row 0: one run of 4; rows 1-2: a left and a right cell; row 3: cell 0 and cells 2-3
    expect(walls).toEqual([
      { x: 0, y: 0, w: 64, h: 16 },
      { x: 0, y: 16, w: 16, h: 16 },
      { x: 48, y: 16, w: 16, h: 16 },
      { x: 0, y: 32, w: 16, h: 16 },
      { x: 48, y: 32, w: 16, h: 16 },
      { x: 0, y: 48, w: 16, h: 16 },
      { x: 32, y: 48, w: 32, h: 16 },
    ]);
    const area = walls.reduce((a, r) => a + r.w * r.h, 0);
    expect(area).toBe(64 * 64 - 5 * 16 * 16);
  });

  it('finds the exit under a point inside its doorway and nothing elsewhere', () => {
    const room = parseRoom(fixtureRaw(), catalog);
    expect(exitAt(room, { x: 20, y: 50 })?.to).toBe('map');
    expect(exitAt(room, { x: 20, y: 40 })).toBeNull();
  });

  it('every shipped exit lies on walkable floor and its arrive point is inside the room, off the exit', () => {
    const room = parseRoom(home, catalog);
    const g = room.gridSize;
    const floor = buildFloorGrid(room);
    for (const e of room.exits) {
      expect(room.walkable.some((r) => e.rect.x >= r.x && e.rect.x + e.rect.w <= r.x + r.w && e.rect.y >= r.y && e.rect.y + e.rect.h <= r.y + r.h)).toBe(true);
      expect(floor[Math.floor(e.arrive.y / g)][Math.floor(e.arrive.x / g)]).toBe(true);
      expect(exitAt(room, e.arrive)).toBeNull();
    }
  });

  it('places catalog items with their size, solidity and use', () => {
    const room = parseRoom(fixtureRaw(), catalog);
    const sofa = room.furniture[0];
    expect(sofa).toMatchObject({ id: 'sofa', x: 100, y: 50, solid: true, use: { kind: 'lounge' } });
    expect(solidRects(room)).toEqual([{ x: 100 - sofa.w / 2, y: 50 - sofa.h / 2, w: sofa.w, h: sofa.h }]);
  });

  it('finds use spots from furniture, with an approach point for hop-on furniture', () => {
    const room = parseRoom(fixtureRaw(), catalog);
    const sofa = room.furniture[0];
    const u = sofa.use!;
    expect(findUseSpot(room, 'lounge')).toEqual({
      item: sofa,
      spot: { x: 100 + u.dx, y: 50 + u.dy },
      approach: { x: 100 + u.dx, y: 50 + u.approachDy! },
    });
    expect(findUseSpot(room, 'eat')).toBeNull();
  });

  it('the shipped spawns and every pet spot sit on walkable floor, clear of solid furniture', () => {
    const room = parseRoom(home, catalog);
    const floor = buildFloorGrid(room);
    const solids = solidRects(room);
    const onFloor = (p: { x: number; y: number }) =>
      floor[Math.floor(p.y / room.gridSize)]?.[Math.floor(p.x / room.gridSize)] === true;
    const inSolid = (p: { x: number; y: number }) => solids.some((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h);
    for (const p of [room.pet, room.player]) {
      expect(onFloor(p)).toBe(true);
      expect(inSolid(p)).toBe(false);
    }
    for (const kind of ['eat', 'sleep', 'lounge'] as const) {
      const u = findUseSpot(room, kind);
      expect(u, kind).not.toBeNull();
      const walkTo = u!.approach ?? u!.spot;
      expect(onFloor(walkTo), kind).toBe(true);
      expect(inSolid(walkTo), kind).toBe(false);
    }
  });

  it('shipped furniture stays inside the room and solid pieces do not overlap', () => {
    const room = parseRoom(home, catalog);
    const { width: w, height: h } = room;
    for (const f of room.furniture) {
      expect(f.x - f.w / 2, f.id).toBeGreaterThanOrEqual(0);
      expect(f.x + f.w / 2, f.id).toBeLessThanOrEqual(w);
      expect(f.y + f.h / 2, f.id).toBeLessThanOrEqual(h);
    }
    const rects = solidRects(room);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `${room.furniture.filter((f) => f.solid)[i].id} vs ${room.furniture.filter((f) => f.solid)[j].id}`).toBe(false);
      }
    }
  });

  it('rejects a walkable rect outside the picture', () => {
    expect(() => parseRoom({ ...fixtureRaw(), walkable: [{ x: 32, y: 32, w: 64, h: 16 }] }, catalog)).toThrow(/room\.walkable\[0\]/);
  });

  it('rejects a grid size that does not divide the picture', () => {
    expect(() => parseRoom({ ...fixtureRaw(), gridSize: 24 }, catalog)).toThrow(/gridSize/);
  });

  it('rejects a placement of unknown furniture', () => {
    expect(() => parseRoom({ ...fixtureRaw(), placements: [{ item: 'piano', x: 0, y: 0 }] }, catalog)).toThrow(/unknown furniture "piano"/);
  });

  it('rejects a pet duration range with min above max', () => {
    const raw = fixtureRaw();
    raw.pet.tuning.durations.idle = [5, 1];
    expect(() => parseRoom(raw, catalog)).toThrow(/durations\.idle/);
  });

  it('rejects catalog entries with duplicate ids or a bad use kind', () => {
    const bed = { id: 'bed', sprite: 's', w: 1, h: 1, solid: true, price: 0 };
    expect(() => parseCatalog([bed, bed])).toThrow(/duplicate id "bed"/);
    expect(() => parseCatalog([{ ...bed, use: { kind: 'dance', dx: 0, dy: 0 } }])).toThrow(/use\.kind/);
  });
});
