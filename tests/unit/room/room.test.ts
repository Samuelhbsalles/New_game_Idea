import { describe, expect, it } from 'vitest';
import home from '../../../src/data/home.json';
import { buildFloorGrid, buildTileFrames, floorFrame, parseRoom, wangIndex } from '../../../src/logic/room';

// Small fixture: a 3x3-tile room with one floor tile in the middle.
function fixtureRaw() {
  return {
    tileSize: 32,
    tileset: 'sheet',
    wangToFrame: [6, 7, 10, 9, 2, 11, 4, 15, 5, 14, 1, 8, 3, 0, 13, 12],
    corners: ['####', '#..#', '#..#', '####'],
    furniture: [{ key: 'bed', x: 10, y: 20, solid: true }],
    player: { character: 'player', x: 48, y: 48, speed: 90, walkFps: 8, interactRange: 40 },
    pet: {
      creatureId: 'c1',
      x: 48,
      y: 48,
      speed: 40,
      walkFps: 8,
      eatSpot: { x: 10, y: 10 },
      sleepSpot: { x: 20, y: 20 },
      foodItemId: 'food',
      tuning: {
        durations: { idle: [1, 2], wander: [1, 2], eat: [1, 2], sleep: [1, 2], petted: [1, 1] },
        weights: { idle: 1, wander: 1, eat: 1, sleep: 1 },
      },
    },
  };
}

describe('room layout', () => {
  it('parses the shipped home.json', () => {
    const room = parseRoom(home);
    expect(room.corners.length).toBeGreaterThan(1);
    expect(room.furniture.length).toBeGreaterThan(0);
  });

  it('computes Wang index as NW*8 + NE*4 + SW*2 + SE*1', () => {
    const c = ['#.', '..'];
    expect(wangIndex(c, 0, 0)).toBe(8);
    expect(wangIndex(['.#', '..'], 0, 0)).toBe(4);
    expect(wangIndex(['..', '#.'], 0, 0)).toBe(2);
    expect(wangIndex(['..', '.#'], 0, 0)).toBe(1);
    expect(wangIndex(['##', '##'], 0, 0)).toBe(15);
  });

  it('builds a tile grid one smaller than the corner grid, floor only where all corners are floor', () => {
    const room = parseRoom(fixtureRaw());
    const tiles = buildTileFrames(room);
    expect(tiles.length).toBe(3);
    expect(tiles[0].length).toBe(3);
    expect(tiles[1][1]).toBe(floorFrame(room));
    const nonFloor = tiles.flat().filter((f) => f !== floorFrame(room));
    expect(nonFloor.length).toBe(8);
  });

  it('every walkable tile in home.json is enclosed by wall tiles', () => {
    const room = parseRoom(home);
    const tiles = buildTileFrames(room);
    const last = tiles.length - 1;
    for (const row of [tiles[0], tiles[last]]) expect(row.every((f) => f !== floorFrame(room))).toBe(true);
    for (const row of tiles) {
      expect(row[0]).not.toBe(floorFrame(room));
      expect(row[row.length - 1]).not.toBe(floorFrame(room));
    }
  });

  it('rejects a ragged corner grid', () => {
    const raw = { ...fixtureRaw(), corners: ['####', '#.#'] };
    expect(() => parseRoom(raw)).toThrow(/room\.corners\[1\]/);
  });

  it('rejects a wangToFrame table that is not 16 entries', () => {
    const raw = { ...fixtureRaw(), wangToFrame: [0, 1] };
    expect(() => parseRoom(raw)).toThrow(/wangToFrame/);
  });

  it('rejects a pet duration range with min above max', () => {
    const raw = fixtureRaw();
    (raw.pet.tuning.durations as Record<string, number[]>).idle = [5, 1];
    expect(() => parseRoom(raw)).toThrow(/durations\.idle/);
  });

  it('the shipped pet spots and spawns sit on walkable floor', () => {
    const room = parseRoom(home);
    const floor = buildFloorGrid(room);
    const onFloor = (p: { x: number; y: number }) => floor[Math.floor(p.y / room.tileSize)]?.[Math.floor(p.x / room.tileSize)] === true;
    expect(onFloor(room.pet)).toBe(true);
    expect(onFloor(room.pet.eatSpot)).toBe(true);
    expect(onFloor(room.pet.sleepSpot)).toBe(true);
    expect(onFloor(room.player)).toBe(true);
  });

  it('rejects furniture without a boolean solid flag', () => {
    const raw = { ...fixtureRaw(), furniture: [{ key: 'bed', x: 0, y: 0, solid: 'yes' }] };
    expect(() => parseRoom(raw)).toThrow(/furniture\[0\]\.solid/);
  });
});
