import { describe, expect, it } from 'vitest';

import type { PageSize } from '../book-frame';
import { createClickTurnPath, DEFAULT_CLICK_TURN_SHAPE, liftLimitInsideSpine } from '../click-turn';
import type { PathTiming } from '../pointer-path';
import { easeOutCubic, linearEasing, samplePointerPath } from '../pointer-path';
import { isWithinSpineLimit, limitPointerToSpine } from '../spine-limit';
import { computeTurnPose, projectToOuterEdge } from '../turn-pose';

const page: PageSize = { width: 400, height: 600 };
const timing: PathTiming = { durationMs: 600, easing: linearEasing };

describe('click-turn', () => {
  describe('virtual pointer path', () => {
    it('should run from the grab point to its mirror across the spine', () => {
      const grab = { x: 400, y: 450 };
      const path = createClickTurnPath(grab, page);

      expect(path.from).toBe(grab);
      expect(path.to).toEqual({ x: -400, y: 450 });
    });

    it('should lift toward the vertical center of the page', () => {
      const lift = DEFAULT_CLICK_TURN_SHAPE.liftRatio * page.height;

      expect(createClickTurnPath({ x: 400, y: 500 }, page).liftOffset).toEqual({ x: 0, y: -lift });
      expect(createClickTurnPath({ x: 400, y: 100 }, page).liftOffset).toEqual({ x: 0, y: lift });
      expect(createClickTurnPath({ x: 400, y: 300 }, page).liftOffset).toEqual({ x: 0, y: -lift });
    });

    it('should move in a straight line when the lift is zero', () => {
      const { liftOffset } = createClickTurnPath({ x: 400, y: 500 }, page, { liftRatio: 0 });

      expect(Math.abs(liftOffset.x) + Math.abs(liftOffset.y)).toBe(0);
    });
  });

  describe('lift limit inside the spine lens', () => {
    it('should be the gap between the opposite-end circle and its center height on the spine', () => {
      // 위로 들 때: 아래 끝점 원 반경 √(400² + 300²) = 500, 세로 거리 300 → 200px.
      expect(liftLimitInsideSpine({ x: 400, y: 300 }, page, true)).toBeCloseTo(200, 9);
      // 아래로 들 때: 위 끝점까지 세로 거리 100 → √(400² + 100²) - 100.
      expect(liftLimitInsideSpine({ x: 400, y: 100 }, page, false)).toBeCloseTo(Math.sqrt(170000) - 100, 9);
    });

    it('should allow the whole grab width at a corner that lifts away from its own end', () => {
      expect(liftLimitInsideSpine({ x: 400, y: 600 }, page, true)).toBe(400);
    });

    it('should be zero for a grab on the spine', () => {
      expect(liftLimitInsideSpine({ x: 0, y: 0 }, page, false)).toBe(0);
      expect(liftLimitInsideSpine({ x: 0, y: 300 }, page, true)).toBe(0);
    });

    it('should shrink the lift on a tall narrow page', () => {
      const tallPage: PageSize = { width: 200, height: 900 };
      const grab = { x: 200, y: 450 };
      const { liftOffset } = createClickTurnPath(grab, tallPage);

      // 원하는 높이는 90px이지만 렌즈가 책등 위에서 위아래 약 42px뿐이다.
      expect(liftOffset.y).toBeCloseTo(-(Math.sqrt(200 * 200 + 450 * 450) - 450), 9);
      expect(-liftOffset.y).toBeLessThan(DEFAULT_CLICK_TURN_SHAPE.liftRatio * tallPage.height);
    });
  });

  describe.each([
    ['bottom corner', 600],
    ['middle of the edge', 300],
    ['top corner', 0],
    ['lower half', 470],
  ])('when clicking near the %s', (_, clickY) => {
    const grab = projectToOuterEdge({ x: 300, y: clickY }, page);
    const path = createClickTurnPath(grab, page);

    it('should start at progress 0 and end at progress 1', () => {
      expect(computeTurnPose(grab, samplePointerPath(path, 0, timing), page).progress).toBe(0);
      expect(computeTurnPose(grab, samplePointerPath(path, timing.durationMs, timing), page).progress).toBe(1);
    });

    it('should never move progress backward', () => {
      let previousProgress = 0;
      for (let elapsedMs = 0; elapsedMs <= timing.durationMs; elapsedMs += 5) {
        const pose = computeTurnPose(grab, samplePointerPath(path, elapsedMs, timing), page);
        expect(pose.progress).toBeGreaterThanOrEqual(previousProgress);
        previousProgress = pose.progress;
      }
    });
  });

  describe.each([
    [400, 600],
    [390, 844],
    [300, 844],
    [250, 844],
    [200, 900],
    [600, 400],
    [100, 1000],
  ])('on a %ix%i page', (width, height) => {
    const ratioPage: PageSize = { width, height };
    const easedTiming: PathTiming = { durationMs: 1000, easing: easeOutCubic };

    it('should stay within the spine limit so the drag model needs no correction', () => {
      for (let step = 0; step <= 20; step += 1) {
        const grab = projectToOuterEdge({ x: width, y: (height * step) / 20 }, ratioPage);
        const path = createClickTurnPath(grab, ratioPage, { liftRatio: 0.3 });
        for (let elapsedMs = 0; elapsedMs <= easedTiming.durationMs; elapsedMs += 1) {
          const pointer = samplePointerPath(path, elapsedMs, easedTiming);
          expect(isWithinSpineLimit(pointer, grab, ratioPage)).toBe(true);
          // 끝 무렵 거울점 1e-6px 안에서는 꼭짓점에 붙는다(spine-limit.ts). 그보다 크게 옮기면 호가 렌즈를 넘은 것이다.
          const limited = limitPointerToSpine(pointer, grab, ratioPage);
          expect(Math.abs(limited.x - pointer.x) + Math.abs(limited.y - pointer.y)).toBeLessThanOrEqual(2e-6);
        }
      }
    });
  });
});
