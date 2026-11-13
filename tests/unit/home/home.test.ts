import { describe, expect, it } from 'vitest';
import furnitureJson from '../../../src/data/furniture.json';
import homeJson from '../../../src/data/home.json';
import { checkPlacement, defaultLayout, doorZones, drop, footprint, parseLayout, pickUp, pieceAt, snap, store, unstore, type HomeLayout } from '../../../src/logic/home';
import { parseCatalog, parseRoom } from '../../../src/logic/room';

const catalog = parseCatalog(furnitureJson);
const room = parseRoom(homeJson, catalog);
const start = (): HomeLayout => defaultLayout(homeJson.placements);
const item = (id: string) => catalog.find((c) => c.id === id)!;

describe('home layout rules', () => {
  it('the starter apartment is itself a valid layout', () => {
    const l = start();
    l.placements.forEach((p, i) => {
      const others = l.placements.filter((_, j) => j !== i);
      expect(checkPlacement(room, catalog, others, p.item, p.x, p.y), p.item).toEqual({ ok: true });
    });
  });

  it('a solid piece stands on its lower half; a low piece lies on all of it', () => {
    expect(footprint(item('bed'), 100, 100)).toEqual({ x: 100 - 31.5, y: 100, w: 63, h: 42.5 });
    expect(footprint(item('rug'), 100, 100)).toEqual({ x: 68, y: 76, w: 64, h: 48 });
  });

  it('refuses a piece off the floor, on the doorway, or on top of a solid piece', () => {
    const l = start();
    expect(checkPlacement(room, catalog, l.placements, 'table', 5, 120)).toEqual({ ok: false, reason: 'outside' });
    const door = doorZones(room)[0];
    expect(checkPlacement(room, catalog, l.placements, 'plant', door.x + door.w / 2, door.y + 4)).toEqual({ ok: false, reason: 'door' });
    const bed = l.placements.find((p) => p.item === 'bed')!;
    expect(checkPlacement(room, catalog, l.placements, 'table', bed.x, bed.y + 10)).toEqual({ ok: false, reason: 'overlap' });
    expect(checkPlacement(room, catalog, l.placements, 'throne', 128, 128)).toEqual({ ok: false, reason: 'unknown' });
  });

  it('low pieces may share floor with each other (a bowl on a rug)', () => {
    const l = { placements: [{ item: 'rug', x: 140, y: 140 }], stored: {} };
    expect(checkPlacement(room, catalog, l.placements, 'bowl', 140, 140)).toEqual({ ok: true });
  });

  it('pick up, then drop elsewhere (snapped to the grid); a refused drop changes nothing', () => {
    const l = start();
    const i = l.placements.findIndex((p) => p.item === 'plant');
    const { layout: lifted, held } = pickUp(l, i);
    expect(lifted.placements).toHaveLength(l.placements.length - 1);
    const bad = drop(room, catalog, lifted, held.item, 5, 5);
    expect(bad.ok).toBe(false);
    const good = drop(room, catalog, lifted, held.item, 150.7, 101.2);
    if (!good.ok) throw new Error(good.reason);
    expect(good.layout.placements.at(-1)).toEqual({ item: 'plant', x: snap(150.7), y: snap(101.2) });
  });

  it('store and unstore keep counts', () => {
    let l = store(store(start(), 'rug'), 'rug');
    expect(l.stored).toEqual({ rug: 2 });
    l = unstore(l, 'rug')!;
    l = unstore(l, 'rug')!;
    expect(l.stored).toEqual({});
    expect(unstore(l, 'rug')).toBeNull();
  });

  it('finds the piece under a point, the front one when pictures overlap', () => {
    const l = start();
    const bed = l.placements.find((p) => p.item === 'bed')!;
    expect(l.placements[pieceAt(catalog, l, bed.x, bed.y)].item).toBe('bed');
    expect(pieceAt(catalog, l, 180, 110)).toBe(-1);
  });

  it('a rug is floor: it may lie by the door and things stand on it; it is picked last', () => {
    const l = start();
    const rug = l.placements.find((p) => p.item === 'cottage_rug')!;
    const door = doorZones(room)[0];
    expect(checkPlacement(room, catalog, l.placements, 'cottage_rug', door.x + door.w / 2, door.y)).toEqual({ ok: true });
    expect(checkPlacement(room, catalog, l.placements, 'table', rug.x, rug.y)).toEqual({ ok: true });
    const bowl = l.placements.find((p) => p.item === 'bowl')!;
    // The bowl overlaps the rug's picture: pointing at it picks the bowl, not the rug.
    expect(l.placements[pieceAt(catalog, l, bowl.x + 10, bowl.y)].item).toBe('bowl');
    expect(l.placements[pieceAt(catalog, l, rug.x, rug.y)].item).toBe('cottage_rug');
  });

  it('reads a saved layout, dropping unknown pieces and bad counts', () => {
    const raw = { placements: [{ item: 'bed', x: 1, y: 2 }, { item: 'throne', x: 1, y: 2 }, { item: 'rug' }], stored: { rug: 2, sofa: 0, throne: 1, plant: 1.5 } };
    expect(parseLayout(raw, catalog)).toEqual({ placements: [{ item: 'bed', x: 1, y: 2 }], stored: { rug: 2 } });
    expect(parseLayout('nope', catalog)).toBeNull();
  });
});
