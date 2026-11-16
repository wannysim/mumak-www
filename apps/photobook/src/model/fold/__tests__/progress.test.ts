import { describe, expect, it } from 'vitest';

import { clampUnit, pointerXForProgress, turnProgress } from '../progress';

describe('progress', () => {
  const grab = { x: 400, y: 300 };

  it('should be 0 while the pointer is still at the grab point', () => {
    expect(turnProgress(grab, { x: 400, y: 300 })).toBe(0);
  });

  it('should be 0.5 when the pointer is on the spine', () => {
    expect(turnProgress(grab, { x: 0, y: 300 })).toBe(0.5);
  });

  it('should be 1 when the pointer reaches the mirror of the grab point', () => {
    expect(turnProgress(grab, { x: -400, y: 300 })).toBe(1);
  });

  it('should ignore the vertical position of the pointer', () => {
    expect(turnProgress(grab, { x: 100, y: 50 })).toBe(turnProgress(grab, { x: 100, y: 550 }));
  });

  it('should clamp pointers beyond either end', () => {
    expect(turnProgress(grab, { x: 520, y: 300 })).toBe(0);
    expect(turnProgress(grab, { x: -900, y: 300 })).toBe(1);
  });

  it('should be 0 when grabbing on or behind the spine', () => {
    expect(turnProgress({ x: 0, y: 300 }, { x: -100, y: 300 })).toBe(0);
    expect(turnProgress({ x: -10, y: 300 }, { x: -100, y: 300 })).toBe(0);
  });

  it('should invert progress back to the pointer x', () => {
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const pointerX = pointerXForProgress(grab.x, progress);
      expect(turnProgress(grab, { x: pointerX, y: 0 })).toBeCloseTo(progress, 12);
    }
  });

  it('should clamp values to the unit interval', () => {
    expect(clampUnit(-0.1)).toBe(0);
    expect(clampUnit(0.3)).toBe(0.3);
    expect(clampUnit(1.2)).toBe(1);
  });
});
