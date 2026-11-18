import { describe, expect, it } from 'vitest';
import catchingJson from '../../../src/data/catching.json';
import creatures from '../../../src/data/creatures.json';
import items from '../../../src/data/items.json';
import shops from '../../../src/data/shops.json';
import start from '../../../src/data/start.json';
import time from '../../../src/data/time.json';
import townJson from '../../../src/data/town.json';
import wildJson from '../../../src/data/wild.json';
import { areaAt, eligibleSpecies, parseCatchRules } from '../../../src/logic/catching';
import { parseWildRules } from '../../../src/logic/climb';
import { buildNavGrid, findPath } from '../../../src/logic/npcMind';
import { parseTown, townSolids, type Box } from '../../../src/logic/town';
import { parseConfig } from '../../../src/logic/config';

/** Same grid the town scene walks on (TownScene NAV_CELL / NAV_PAD). */
const NAV_CELL = 16;
const NAV_PAD = 6;
/** Where the harbour path enters the forest, and the middle of each glade. */
const ENTRY_WEST = { x: 1720, y: 450 };
const ENTRY_EAST = { x: 2210, y: 450 };
const GLADES = [
  { x: 1760, y: 300 },
  { x: 1990, y: 240 },
  { x: 2185, y: 350 },
];
/** The camera stops following when the player's centre is less than half a screen (135px) from the top. */
const CAMERA_HALF_HEIGHT = 135;
const FEET_BELOW_CENTRE = 20;

const town = parseTown(townJson);
const solids = townSolids(town);
const nav = buildNavGrid(town.cols * town.tileSize, town.rows * town.tileSize, NAV_CELL, solids, NAV_PAD);
const config = parseConfig({ species: creatures, shops, items, start, time });
const species = config.species;
const rules = parseCatchRules(catchingJson, species, items.map((i) => i.id));
const inBox = (p: { x: number; y: number }, b: Box) => p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h;

describe('forest: getting around', () => {
  it('every glade can be reached on foot from both harbour entrances', () => {
    for (const from of [ENTRY_WEST, ENTRY_EAST]) {
      for (const g of GLADES) expect(findPath(nav, from, g).length, `${JSON.stringify(from)} -> ${JSON.stringify(g)}`).toBeGreaterThan(0);
    }
  });

  it('the player cannot walk up to where the camera stops following (an invisible wall behind the top trees)', () => {
    // Arrange: the highest feet line where the camera still follows.
    const lowestFreeFeet = CAMERA_HALF_HEIGHT + FEET_BELOW_CENTRE;
    // Assert: every point of the forest above it is inside a blocker.
    for (let x = 1600; x <= 2290; x += 10) {
      for (let y = 0; y < lowestFreeFeet; y += 5) expect(town.blockers.some((b) => inBox({ x, y }, b)), `(${x}, ${y}) is walkable`).toBe(true);
    }
  });

  it('glowing mushrooms, mushrooms, ferns and the rune stone are solid where the player can reach them', () => {
    const shouldBlock = ['forest_glowshrooms', 'forest_mushrooms', 'forest_ferns', 'forest_runestone'];
    const reachable = town.props.filter((p) => shouldBlock.includes(p.sprite) && !town.blockers.some((b) => inBox(p, b)));
    expect(reachable.length).toBeGreaterThan(0);
    for (const p of reachable) expect(p.solid, `${p.sprite} at (${p.x}, ${p.y})`).not.toBeNull();
  });
});

describe('forest: its animals', () => {
  const ctx = { night: false, weather: 'clear' };

  it('monkeys, sloths and chameleons live in the forest, and monkeys no longer in the park', () => {
    const forest = eligibleSpecies(species, 'forest', ctx).map((s) => s.id);
    expect(forest).toEqual(expect.arrayContaining(['monkey', 'sloth', 'chameleon']));
    expect(eligibleSpecies(species, 'park', ctx).map((s) => s.id)).not.toContain('monkey');
  });

  it('fireflies come out in the forest at night', () => {
    expect(eligibleSpecies(species, 'forest', { night: true, weather: 'clear' }).map((s) => s.id)).toContain('firefly');
  });

  it('every glade is inside the forest area, so bait put down there brings forest animals', () => {
    for (const g of GLADES) expect(areaAt(rules, g, 'town')?.id, JSON.stringify(g)).toBe('forest');
  });

  it('forest animals spawn only where the player can go (not behind the top wall)', () => {
    for (const box of rules.areas.forest.inTown ?? []) {
      for (const b of town.blockers) expect(box.y >= b.y + b.h || box.x >= b.x + b.w || b.x >= box.x + box.w).toBe(true);
    }
  });

  it('monkeys and sloths can climb the forest trees', () => {
    const wild = parseWildRules(wildJson);
    expect(Object.keys(wild.climbers)).toEqual(expect.arrayContaining(['monkey', 'sloth']));
    const trees = town.props.filter((p) => wild.treeSprites.includes(p.sprite) && p.x >= 1600);
    expect(trees.length).toBeGreaterThan(10);
  });
});
