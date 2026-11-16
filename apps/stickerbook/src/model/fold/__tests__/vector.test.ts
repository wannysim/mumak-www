import { describe, expect, it } from 'vitest';

import {
  addVec,
  distanceVec,
  dotVec,
  lengthSquaredVec,
  lengthVec,
  lerpVec,
  normalizeVec,
  scaleVec,
  subtractVec,
  vec2,
} from '../vector';

describe('vector', () => {
  it('should build, add, subtract and scale vectors', () => {
    const a = vec2(3, 4);
    const b = vec2(-1, 2);

    expect(addVec(a, b)).toEqual({ x: 2, y: 6 });
    expect(subtractVec(a, b)).toEqual({ x: 4, y: 2 });
    expect(scaleVec(a, -2)).toEqual({ x: -6, y: -8 });
  });

  it('should measure dot products, lengths and distances', () => {
    expect(dotVec(vec2(3, 4), vec2(-1, 2))).toBe(5);
    expect(lengthSquaredVec(vec2(3, 4))).toBe(25);
    expect(lengthVec(vec2(3, 4))).toBe(5);
    expect(distanceVec(vec2(1, 1), vec2(4, 5))).toBe(5);
  });

  it('should normalize a vector to unit length', () => {
    const unit = normalizeVec(vec2(0, -8));

    expect(unit).toEqual({ x: 0, y: -1 });
  });

  it('should return null when normalizing a zero vector', () => {
    expect(normalizeVec(vec2(0, 0))).toBeNull();
  });

  it('should interpolate and extrapolate linearly', () => {
    const a = vec2(0, 10);
    const b = vec2(10, 30);

    expect(lerpVec(a, b, 0)).toEqual(a);
    expect(lerpVec(a, b, 0.5)).toEqual({ x: 5, y: 20 });
    expect(lerpVec(a, b, 1)).toEqual(b);
    expect(lerpVec(a, b, 2)).toEqual({ x: 20, y: 50 });
  });

  it('should not mutate its inputs', () => {
    const a = Object.freeze(vec2(1, 2));
    const b = Object.freeze(vec2(3, 4));

    expect(() => [addVec(a, b), subtractVec(a, b), scaleVec(a, 2), lerpVec(a, b, 0.3)]).not.toThrow();
    expect(a).toEqual({ x: 1, y: 2 });
  });
});
