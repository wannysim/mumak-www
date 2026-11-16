import { describe, expect, it } from 'vitest';

import { cubicBezier, OPEN_EASING } from '../easing';

describe('cubicBezier', () => {
  it('should pin both ends and clamp outside the unit range', () => {
    const ease = cubicBezier(0.25, 0.1, 0.25, 1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(-0.5)).toBe(0);
    expect(ease(1.5)).toBe(1);
  });

  it('should match the linear curve when control points lie on the diagonal', () => {
    const linear = cubicBezier(1 / 3, 1 / 3, 2 / 3, 2 / 3);
    for (const x of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      expect(linear(x)).toBeCloseTo(x, 6);
    }
  });

  it('should match the CSS ease curve at reference points', () => {
    // CSS `ease` = cubic-bezier(0.25, 0.1, 0.25, 1). ease(0.5) ≈ 0.8024 (Chromium/WebKit UnitBezier).
    const ease = cubicBezier(0.25, 0.1, 0.25, 1);
    expect(ease(0.5)).toBeCloseTo(0.8024, 3);
  });

  it('should stay monotonic for the opening curve', () => {
    let previous = 0;
    for (let step = 1; step <= 100; step += 1) {
      const value = OPEN_EASING(step / 100);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
    expect(OPEN_EASING(0.5)).toBeGreaterThan(0.9);
  });

  it('should fall back to bisection where the slope vanishes', () => {
    // x1 = 0이면 t = 0 근처에서 x'(t) = 0이라 뉴턴법이 멈춘다.
    const steep = cubicBezier(0, 0, 0, 1);
    const value = steep(0.0001);
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(1);
  });

  it.each([
    [-0.1, 0, 0.5, 1],
    [0.5, 0, 1.2, 1],
  ])('should reject control x outside [0, 1]: %f, %f, %f, %f', (x1, y1, x2, y2) => {
    expect(() => cubicBezier(x1, y1, x2, y2)).toThrow(RangeError);
  });
});
