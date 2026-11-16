import { describe, expect, it } from 'vitest';

import type { PathTiming, PointerPath } from '../pointer-path';
import {
  DEFAULT_TURN_TIMING,
  easeOutCubic,
  isPathFinished,
  linearEasing,
  pathParameterAt,
  pointOnPath,
  samplePointerPath,
} from '../pointer-path';

const path: PointerPath = {
  from: { x: 400, y: 500 },
  to: { x: -400, y: 500 },
  liftOffset: { x: 0, y: -60 },
};
const linearTiming: PathTiming = { durationMs: 400, easing: linearEasing };

describe('pointer-path', () => {
  it('should fix easing endpoints at 0 and 1', () => {
    expect(linearEasing(0)).toBe(0);
    expect(linearEasing(1)).toBe(1);
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBe(0.875);
  });

  it('should expose a temporary default timing', () => {
    expect(DEFAULT_TURN_TIMING.durationMs).toBeGreaterThan(0);
    expect(DEFAULT_TURN_TIMING.easing(1)).toBe(1);
  });

  it('should start exactly at from and end exactly at to', () => {
    expect(samplePointerPath(path, 0, linearTiming)).toBe(path.from);
    expect(samplePointerPath(path, 400, linearTiming)).toBe(path.to);
  });

  it('should clamp elapsed time outside the duration', () => {
    expect(samplePointerPath(path, -50, linearTiming)).toBe(path.from);
    expect(samplePointerPath(path, 10_000, linearTiming)).toBe(path.to);
  });

  it('should reach the full lift offset halfway along the path', () => {
    expect(pointOnPath(path, 0.5)).toEqual({ x: 0, y: 440 });
  });

  it('should jump straight to the end when the duration is not positive', () => {
    const instant: PathTiming = { durationMs: 0, easing: linearEasing };

    expect(pathParameterAt(0, instant)).toBe(1);
    expect(samplePointerPath(path, 0, instant)).toBe(path.to);
  });

  it('should depend only on elapsed time, not on how often it is sampled', () => {
    const frameTimes = (refreshRateHz: number) =>
      Array.from({ length: (refreshRateHz * 400) / 1000 + 1 }, (_, frame) => (frame * 1000) / refreshRateHz);
    const sampleAt100ms = [30, 60, 120].map(refreshRateHz => {
      const time = frameTimes(refreshRateHz).find(t => t === 100);
      return samplePointerPath(path, time!, DEFAULT_TURN_TIMING);
    });

    expect(sampleAt100ms[1]).toEqual(sampleAt100ms[0]);
    expect(sampleAt100ms[2]).toEqual(sampleAt100ms[0]);
  });

  it('should report when the path has finished', () => {
    expect(isPathFinished(399, linearTiming)).toBe(false);
    expect(isPathFinished(400, linearTiming)).toBe(true);
  });
});
