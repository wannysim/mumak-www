import { describe, expect, it } from 'vitest';

import type { PointerSample } from '../velocity';
import { DEFAULT_VELOCITY_WINDOW_MS, estimateVelocity, retainSamplesForWindow } from '../velocity';

const REFRESH_RATES_HZ = [30, 60, 120] as const;

/** 일정한 속도로 움직이는 포인터를 주사율 간격으로 샘플링한다. 시각은 (i·1000)/Hz로 계산해 같은 끝 시각을 맞춘다. */
function constantVelocitySamples(
  refreshRateHz: number,
  durationMs: number,
  velocity: { x: number; y: number },
  start = { x: 400, y: 300 }
): PointerSample[] {
  const frameCount = Math.round((durationMs * refreshRateHz) / 1000);
  const samples: PointerSample[] = [];
  for (let frame = 0; frame <= frameCount; frame += 1) {
    const t = (frame * 1000) / refreshRateHz;
    samples.push({ x: start.x + velocity.x * t, y: start.y + velocity.y * t, t });
  }
  return samples;
}

describe('velocity', () => {
  it('should return zero velocity without samples', () => {
    expect(estimateVelocity([])).toEqual({ x: 0, y: 0 });
  });

  it('should return zero velocity for a single sample', () => {
    expect(estimateVelocity([{ x: 10, y: 10, t: 5 }])).toEqual({ x: 0, y: 0 });
  });

  it('should return zero velocity when every sample has the same time', () => {
    const samples = [
      { x: 0, y: 0, t: 16 },
      { x: 50, y: 0, t: 16 },
    ];

    expect(estimateVelocity(samples, 100)).toEqual({ x: 0, y: 0 });
  });

  it('should return zero velocity when the window is not positive', () => {
    const samples = constantVelocitySamples(60, 200, { x: -0.5, y: 0 });

    expect(estimateVelocity(samples, 0)).toEqual({ x: 0, y: 0 });
  });

  it.each(REFRESH_RATES_HZ)('should measure a constant velocity exactly at %iHz', refreshRateHz => {
    const samples = constantVelocitySamples(refreshRateHz, 300, { x: -0.8, y: 0.15 });
    const velocity = estimateVelocity(samples, 100);

    expect(velocity.x).toBeCloseTo(-0.8, 9);
    expect(velocity.y).toBeCloseTo(0.15, 9);
  });

  it('should give the same velocity at 30, 60 and 120Hz', () => {
    const velocities = REFRESH_RATES_HZ.map(refreshRateHz =>
      estimateVelocity(constantVelocitySamples(refreshRateHz, 300, { x: -0.31, y: 0.02 }), 100)
    );
    const [reference, ...others] = velocities;
    for (const velocity of others) {
      expect(velocity.x).toBeCloseTo(reference!.x, 12);
      expect(velocity.y).toBeCloseTo(reference!.y, 12);
    }
  });

  it('should measure a constant velocity exactly with irregular sample times', () => {
    const times = [0, 7, 31, 33, 58, 91, 104, 140, 141, 175, 199];
    const samples = times.map(t => ({ x: 400 - 0.6 * t, y: 300 + 0.1 * t, t }));
    const velocity = estimateVelocity(samples, 100);

    expect(velocity.x).toBeCloseTo(-0.6, 9);
    expect(velocity.y).toBeCloseTo(0.1, 9);
  });

  it('should measure only the recent window when the speed changes', () => {
    // 0–100ms는 -1 px/ms, 100–200ms는 멈춤. 마지막 100ms 창의 속도는 0이다.
    const samples: PointerSample[] = [];
    for (let t = 0; t <= 200; t += 10) {
      samples.push({ x: 400 - Math.min(t, 100), y: 300, t });
    }

    expect(estimateVelocity(samples, 100).x).toBeCloseTo(0, 12);
    expect(estimateVelocity(samples, 200).x).toBeCloseTo(-0.5, 12);
  });

  it('should measure zero when the pointer did not move across a gap', () => {
    const samples = [
      { x: 400, y: 300, t: 0 },
      { x: 300, y: 300, t: 50 },
      { x: 300, y: 300, t: 400 },
    ];

    expect(estimateVelocity(samples, 100)).toEqual({ x: 0, y: 0 });
  });

  it('should interpolate linearly across a gap when the position changed', () => {
    // 50ms에서 400ms 사이를 등속으로 보므로 창 시작 300ms의 위치는 300 - 100·(250/350)이다.
    const samples = [
      { x: 400, y: 300, t: 0 },
      { x: 300, y: 300, t: 50 },
      { x: 200, y: 300, t: 400 },
    ];
    const velocity = estimateVelocity(samples, 100);

    expect(velocity.x).toBeCloseTo(-2 / 7, 12);
    expect(velocity.y).toBe(0);
  });

  it('should use the oldest sample when history is shorter than the window', () => {
    const samples = [
      { x: 400, y: 300, t: 0 },
      { x: 380, y: 300, t: 40 },
    ];

    expect(estimateVelocity(samples, DEFAULT_VELOCITY_WINDOW_MS)).toEqual({ x: -0.5, y: 0 });
  });

  it('should keep only the samples needed for the window', () => {
    const samples = constantVelocitySamples(60, 500, { x: -0.4, y: 0 });
    const retained = retainSamplesForWindow(samples, 100);

    expect(retained[0]!.t).toBeLessThanOrEqual(400);
    expect(retained[1]!.t).toBeGreaterThan(400);
    expect(retained.at(-1)).toEqual(samples.at(-1));
    expect(estimateVelocity(retained, 100)).toEqual(estimateVelocity(samples, 100));
  });

  it('should keep everything when history is shorter than the window', () => {
    const samples = [
      { x: 1, y: 1, t: 10 },
      { x: 2, y: 1, t: 20 },
    ];

    expect(retainSamplesForWindow(samples)).toEqual(samples);
    expect(retainSamplesForWindow([])).toEqual([]);
  });
});
