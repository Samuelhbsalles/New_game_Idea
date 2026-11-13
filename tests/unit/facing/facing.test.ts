import { describe, expect, it } from 'vitest';
import { facingFor } from '../../../src/logic/facing';

const D = Math.SQRT1_2;

describe('facingFor', () => {
  it('keeps the current facing when standing still', () => {
    expect(facingFor(0, 0, 'up')).toBe('up');
  });

  it('follows a single axis', () => {
    expect(facingFor(1, 0, 'down')).toBe('right');
    expect(facingFor(-1, 0, 'down')).toBe('left');
    expect(facingFor(0, 1, 'up')).toBe('down');
    expect(facingFor(0, -1, 'down')).toBe('up');
  });

  it('keeps facing down when left is added to a downward walk', () => {
    expect(facingFor(-D, D, 'down')).toBe('down');
  });

  it('keeps facing left when down is added to a leftward walk', () => {
    expect(facingFor(-D, D, 'left')).toBe('left');
  });

  it('picks the horizontal facing on a fresh diagonal', () => {
    expect(facingFor(D, -D, 'down')).toBe('right');
    expect(facingFor(-D, D, 'up')).toBe('left');
  });

  it('lets a clearly dominant axis win over the current facing', () => {
    expect(facingFor(1, 0.2, 'down')).toBe('right');
    expect(facingFor(0.2, -1, 'right')).toBe('up');
  });
});
