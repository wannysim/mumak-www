import { describe, expect, it } from 'vitest';

import type { ReleaseConfig } from '../release';
import {
  createSettlePath,
  decideRelease,
  DEFAULT_COMMIT_PROGRESS,
  DEFAULT_RELEASE_CONFIG,
  DEFAULT_VELOCITY_THRESHOLD_PX_PER_MS,
  turningSpeed,
} from '../release';
import type { PointerSample } from '../velocity';
import { estimateVelocity } from '../velocity';

const STILL = { x: 0, y: 0 };
const config: ReleaseConfig = { commitProgress: 0.5, velocityThreshold: 0.3 };

describe('release', () => {
  it('should expose candidate defaults as named constants', () => {
    expect(DEFAULT_RELEASE_CONFIG).toEqual({
      commitProgress: DEFAULT_COMMIT_PROGRESS,
      velocityThreshold: DEFAULT_VELOCITY_THRESHOLD_PX_PER_MS,
    });
  });

  it('should treat movement toward -x as the turning direction', () => {
    expect(turningSpeed({ x: -0.4, y: 0.2 })).toBe(0.4);
    expect(turningSpeed({ x: 0.4, y: 0 })).toBe(-0.4);
  });

  describe('progress boundary', () => {
    it('should return at progress 0 without speed', () => {
      expect(decideRelease({ progress: 0, velocity: STILL }, config)).toBe('return');
    });

    it('should return just below the commit progress', () => {
      expect(decideRelease({ progress: 0.4999, velocity: STILL }, config)).toBe('return');
    });

    it('should complete exactly at the commit progress', () => {
      expect(decideRelease({ progress: 0.5, velocity: STILL }, config)).toBe('complete');
    });

    it('should complete at progress 1', () => {
      expect(decideRelease({ progress: 1, velocity: STILL }, config)).toBe('complete');
    });

    it('should still complete past the commit progress when flicked backward', () => {
      expect(decideRelease({ progress: 0.6, velocity: { x: 2, y: 0 } }, config)).toBe('complete');
    });
  });

  describe('velocity boundary', () => {
    it('should return just below the speed threshold', () => {
      expect(decideRelease({ progress: 0.1, velocity: { x: -0.2999, y: 0 } }, config)).toBe('return');
    });

    it('should complete exactly at the speed threshold', () => {
      expect(decideRelease({ progress: 0.1, velocity: { x: -0.3, y: 0 } }, config)).toBe('complete');
    });

    it('should ignore vertical speed', () => {
      expect(decideRelease({ progress: 0.1, velocity: { x: 0, y: -5 } }, config)).toBe('return');
    });

    it('should return when moving fast away from the spine', () => {
      expect(decideRelease({ progress: 0.2, velocity: { x: 1, y: 0 } }, config)).toBe('return');
    });
  });

  it('should use the default config when none is given', () => {
    expect(decideRelease({ progress: DEFAULT_COMMIT_PROGRESS, velocity: STILL })).toBe('complete');
    expect(decideRelease({ progress: 0, velocity: { x: -DEFAULT_VELOCITY_THRESHOLD_PX_PER_MS, y: 0 } })).toBe(
      'complete'
    );
  });

  it.each([0.299, 0.301])(
    'should reach the same decision at 30, 60 and 120Hz for a flick at %f px/ms',
    speedPxPerMs => {
      const decisions = [30, 60, 120].map(refreshRateHz => {
        const samples: PointerSample[] = [];
        for (let frame = 0; frame <= (refreshRateHz * 240) / 1000; frame += 1) {
          const t = (frame * 1000) / refreshRateHz;
          samples.push({ x: 380 - speedPxPerMs * t, y: 300, t });
        }
        return decideRelease({ progress: 0.2, velocity: estimateVelocity(samples, 100) }, config);
      });

      expect(new Set(decisions).size).toBe(1);
      expect(decisions[0]).toBe(speedPxPerMs >= 0.3 ? 'complete' : 'return');
    }
  );

  describe('settle path', () => {
    const grab = { x: 400, y: 500 };
    const released = { x: 60, y: 420 };

    it('should head to the mirror of the grab point when completing', () => {
      expect(createSettlePath(grab, released, 'complete')).toEqual({
        from: released,
        to: { x: -400, y: 500 },
        liftOffset: { x: 0, y: 0 },
      });
    });

    it('should head back to the grab point when returning', () => {
      expect(createSettlePath(grab, released, 'return')).toEqual({
        from: released,
        to: grab,
        liftOffset: { x: 0, y: 0 },
      });
    });
  });
});
