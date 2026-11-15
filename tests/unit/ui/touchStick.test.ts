import { describe, expect, it } from 'vitest';
import { stickDirs } from '../../../src/logic/touchStick';

const R = 50;
const DEAD = 0.3;

describe('touch stick', () => {
  it('inside the dead zone presses nothing', () => {
    expect(stickDirs(5, -10, R, DEAD)).toEqual([]);
  });

  it('a push straight right or up presses only that way', () => {
    expect(stickDirs(40, 2, R, DEAD)).toEqual(['right']);
    expect(stickDirs(-3, -45, R, DEAD)).toEqual(['up']); // screen y grows downward
  });

  it('a push near 45 degrees presses both ways (diagonal walk)', () => {
    expect(stickDirs(30, 30, R, DEAD).sort()).toEqual(['down', 'right']);
    expect(stickDirs(-30, -28, R, DEAD).sort()).toEqual(['left', 'up']);
  });

  it('a mostly-horizontal push with a little lean stays one way', () => {
    expect(stickDirs(-45, 12, R, DEAD)).toEqual(['left']);
  });

  it('beyond the rim still counts (the knob is clamped, not the finger)', () => {
    expect(stickDirs(0, 400, R, DEAD)).toEqual(['down']);
  });
});
