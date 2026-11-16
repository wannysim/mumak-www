import { describe, expect, it } from 'vitest';

import type { PageSize } from '../book-frame';
import type { CurlPose } from '../cylinder';
import {
  curlPoint,
  DEFAULT_CURL_SOLVE_OPTIONS,
  limitRadiusToSpine,
  solveCurlAngle,
  solveCurlPose,
  wrapOnCylinder,
} from '../cylinder';
import { createFoldLine, isFoldedPoint, reflectAcrossFold } from '../reflect-fold';
import { spineEndpoints } from '../spine-limit';
import type { Vec2 } from '../vector';
import { distanceVec, dotVec, subtractVec } from '../vector';

const page: PageSize = { width: 400, height: 600 };

function planarDistance(point: { x: number; y: number }, target: Vec2): number {
  return distanceVec({ x: point.x, y: point.y }, target);
}

function spineCurlDistance(pose: CurlPose): number {
  const { top, bottom } = spineEndpoints(page);
  return Math.max(
    dotVec(subtractVec(top, pose.tangentPoint), pose.axis),
    dotVec(subtractVec(bottom, pose.tangentPoint), pose.axis)
  );
}

describe('cylinder', () => {
  describe('wrapOnCylinder', () => {
    const radius = 50;

    it('should leave points behind the tangent line flat', () => {
      expect(wrapOnCylinder(-12, radius)).toEqual({ along: -12, height: 0, angle: 0 });
      expect(wrapOnCylinder(0, radius)).toEqual({ along: 0, height: 0, angle: 0 });
    });

    it('should wrap a quarter turn to the top of the cylinder side', () => {
      const wrap = wrapOnCylinder((Math.PI * radius) / 2, radius);

      expect(wrap.along).toBeCloseTo(radius, 9);
      expect(wrap.height).toBeCloseTo(radius, 9);
      expect(wrap.angle).toBeCloseTo(Math.PI / 2, 12);
    });

    it('should reach the top of the cylinder after half a turn', () => {
      const wrap = wrapOnCylinder(Math.PI * radius, radius);

      expect(wrap.along).toBeCloseTo(0, 9);
      expect(wrap.height).toBeCloseTo(2 * radius, 9);
    });

    it('should continue as a flipped flat sheet past πr', () => {
      const distance = Math.PI * radius + 30;

      expect(wrapOnCylinder(distance, radius)).toEqual({ along: -30, height: 2 * radius, angle: Math.PI });
    });

    it('should reduce to a planar reflection when the radius is zero', () => {
      expect(wrapOnCylinder(30, 0)).toEqual({ along: -30, height: 0, angle: Math.PI });
    });
  });

  describe('solveCurlAngle (D/R = θ − sinθ)', () => {
    it.each([0.01, 1, 0.0001])('should converge within a tolerance of %f px', tolerancePx => {
      const solution = solveCurlAngle(120, 80, { tolerancePx, maxIterations: 200 });

      expect(Math.abs(solution.residualPx)).toBeLessThanOrEqual(tolerancePx);
      expect(80 * (solution.angle - Math.sin(solution.angle)) - 120).toBe(solution.residualPx);
    });

    it('should need more iterations for a tighter tolerance', () => {
      const loose = solveCurlAngle(120, 80, { tolerancePx: 1, maxIterations: 200 });
      const tight = solveCurlAngle(120, 80, { tolerancePx: 1e-6, maxIterations: 200 });

      expect(tight.iterations).toBeGreaterThan(loose.iterations);
    });

    it('should stop at the iteration cap even with zero tolerance', () => {
      const solution = solveCurlAngle(120, 80, { tolerancePx: 0, maxIterations: 12 });

      expect(solution.iterations).toBe(12);
    });

    it('should approach zero for a zero distance', () => {
      const solution = solveCurlAngle(0, 80, DEFAULT_CURL_SOLVE_OPTIONS);

      expect(solution.angle).toBeLessThan(0.1);
      expect(Math.abs(solution.residualPx)).toBeLessThanOrEqual(DEFAULT_CURL_SOLVE_OPTIONS.tolerancePx);
    });

    it('should pin to π with the leftover residual when the distance exceeds πr', () => {
      const { tolerancePx } = DEFAULT_CURL_SOLVE_OPTIONS;
      const solution = solveCurlAngle(400, 80, DEFAULT_CURL_SOLVE_OPTIONS);

      expect(solution.angle).toBeLessThan(Math.PI);
      expect(Math.PI - solution.angle).toBeLessThanOrEqual(tolerancePx / (2 * 80));
      expect(Math.abs(solution.residualPx - (80 * Math.PI - 400))).toBeLessThanOrEqual(tolerancePx);
      expect(solution.iterations).toBeLessThan(DEFAULT_CURL_SOLVE_OPTIONS.maxIterations);
    });

    describe('when the distance is small and θ - sinθ is flat', () => {
      const exactOptions = { tolerancePx: 1e-12, maxIterations: 200 };
      const tangentOffset = (distancePx: number, radiusPx: number, options = DEFAULT_CURL_SOLVE_OPTIONS) =>
        radiusPx * Math.sin(solveCurlAngle(distancePx, radiusPx, options).angle);

      it.each([80, 200])('should place the tangent line within tolerance of the exact solve (r = %ipx)', radius => {
        for (let step = 1; step <= 500; step += 1) {
          const distance = step * 0.01;
          const error = Math.abs(tangentOffset(distance, radius) - tangentOffset(distance, radius, exactOptions));
          expect(error).toBeLessThanOrEqual(DEFAULT_CURL_SOLVE_OPTIONS.tolerancePx / 2);
        }
      });

      it.each([80, 200])(
        'should move the tangent line no more than the exact solve does per 0.01px of pointer motion (r = %ipx)',
        radius => {
          const { tolerancePx } = DEFAULT_CURL_SOLVE_OPTIONS;
          for (let step = 1; step < 100; step += 1) {
            const jump = Math.abs(tangentOffset((step + 1) * 0.01, radius) - tangentOffset(step * 0.01, radius));
            const exactJump = Math.abs(
              tangentOffset((step + 1) * 0.01, radius, exactOptions) - tangentOffset(step * 0.01, radius, exactOptions)
            );
            expect(jump).toBeLessThanOrEqual(exactJump + tolerancePx);
          }
        }
      );
    });

    it('should use the default options when none are given', () => {
      expect(solveCurlAngle(120, 80)).toEqual(solveCurlAngle(120, 80, DEFAULT_CURL_SOLVE_OPTIONS));
    });
  });

  describe('solveCurlPose', () => {
    it('should return null when the pointer is at the grab point', () => {
      expect(solveCurlPose({ x: 400, y: 600 }, { x: 400, y: 600 }, 40)).toBeNull();
    });

    const followCases: Array<[string, Vec2, Vec2, number]> = [
      ['corner, grabbed point on the cylinder', { x: 400, y: 600 }, { x: 340, y: 560 }, 60],
      ['corner, grabbed point on the flipped sheet', { x: 400, y: 600 }, { x: 80, y: 420 }, 40],
      ['edge middle, grabbed point on the cylinder', { x: 400, y: 300 }, { x: 310, y: 300 }, 90],
      ['edge middle, grabbed point on the flipped sheet', { x: 400, y: 300 }, { x: -200, y: 260 }, 30],
      ['top corner, tiny pull', { x: 400, y: 0 }, { x: 399, y: 1 }, 120],
    ];

    it.each(followCases)('should keep the grabbed point under the pointer (%s)', (_, grab, pointer, radius) => {
      const pose = solveCurlPose(grab, pointer, radius)!;
      const curledGrab = curlPoint(grab, pose);

      expect(planarDistance(curledGrab, pointer)).toBeLessThanOrEqual(DEFAULT_CURL_SOLVE_OPTIONS.tolerancePx);
      expect(curledGrab.z).toBeGreaterThan(0);
      expect(curledGrab.z).toBeLessThanOrEqual(2 * radius + 1e-9);
    });

    it('should hit the pointer exactly with the closed form on the flipped sheet', () => {
      const grab = { x: 400, y: 600 };
      const pointer = { x: 80, y: 420 };
      const pose = solveCurlPose(grab, pointer, 40)!;

      expect(pose.grabAngle).toBe(Math.PI);
      expect(pose.residualPx).toBe(0);
      expect(pose.iterations).toBe(0);
      expect(planarDistance(curlPoint(grab, pose), pointer)).toBeLessThan(1e-9);
    });

    it('should match the planar reflection fold when the radius is zero', () => {
      const grab = { x: 400, y: 600 };
      const pointer = { x: 150, y: 450 };
      const pose = solveCurlPose(grab, pointer, 0)!;
      const fold = createFoldLine(grab, pointer)!;
      for (const point of [grab, { x: 400, y: 0 }, { x: 300, y: 590 }, { x: 0, y: 0 }]) {
        const expected = isFoldedPoint(point, fold) ? reflectAcrossFold(point, fold) : point;
        const curled = curlPoint(point, pose);
        expect(curled.x).toBeCloseTo(expected.x, 9);
        expect(curled.y).toBeCloseTo(expected.y, 9);
        expect(curled.z).toBe(0);
      }
    });

    it('should treat a negative radius as zero', () => {
      expect(solveCurlPose({ x: 400, y: 300 }, { x: 200, y: 300 }, -5)!.radius).toBe(0);
    });

    it('should leave points on the pointer side of the tangent line flat', () => {
      const pose = solveCurlPose({ x: 400, y: 300 }, { x: 310, y: 300 }, 90)!;
      const spinePoint = { x: 0, y: 200 };

      expect(curlPoint(spinePoint, pose)).toEqual({ x: 0, y: 200, z: 0 });
    });
  });

  describe('limitRadiusToSpine', () => {
    it('should keep the desired radius when the spine already stays flat', () => {
      expect(limitRadiusToSpine({ x: 400, y: 300 }, { x: 350, y: 300 }, page, 10)).toBe(10);
    });

    it('should shrink the radius until the spine stays flat', () => {
      const grab = { x: 400, y: 300 };
      const pointer = { x: 100, y: 300 };
      const tolerancePx = 0.01;
      const radius = limitRadiusToSpine(grab, pointer, page, 200, { tolerancePx, maxIterations: 64 });

      expect(radius).toBeGreaterThan(0);
      expect(radius).toBeLessThan(200);
      expect(spineCurlDistance(solveCurlPose(grab, pointer, radius)!)).toBeLessThanOrEqual(1e-9);
      expect(spineCurlDistance(solveCurlPose(grab, pointer, radius + 0.5)!)).toBeGreaterThan(0);
    });

    it('should flatten to zero radius at progress 1', () => {
      expect(limitRadiusToSpine({ x: 400, y: 300 }, { x: -400, y: 300 }, page, 80)).toBe(0);
    });

    it('should return the desired radius when nothing is folded', () => {
      expect(limitRadiusToSpine({ x: 400, y: 300 }, { x: 400, y: 300 }, page, 80)).toBe(80);
    });

    it('should not return a negative radius', () => {
      expect(limitRadiusToSpine({ x: 400, y: 300 }, { x: 100, y: 300 }, page, -3)).toBe(0);
    });
  });
});
