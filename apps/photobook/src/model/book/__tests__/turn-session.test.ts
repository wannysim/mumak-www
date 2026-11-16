import { describe, expect, it } from 'vitest';

import { DEFAULT_TURN_TIMING } from '@/model/fold';

import type { TurnSetup } from '../turn-session';
import {
  advanceTurn,
  beginClickTurn,
  beginDragTurn,
  cancelDragTurn,
  continueDragTurn,
  currentTurnPose,
  DEFAULT_GRAB_HEIGHT_RATIO,
  isTurnSettled,
  MIN_DRAG_ORIGIN_RATIO,
  releaseDragTurn,
  settleOutcome,
  settleTiming,
} from '../turn-session';

const page = { width: 300, height: 400 };
const forward: TurnSetup = {
  frame: { spineAxis: 'vertical', spineOrigin: { x: 300, y: 0 } },
  direction: 'forward',
  page,
};
const backward: TurnSetup = { ...forward, direction: 'backward' };

describe('turn session', () => {
  describe('click turn', () => {
    it('should grab the outer edge at the default height when there is no press point', () => {
      const session = beginClickTurn(forward, null);
      expect(session.grab).toEqual({ x: 300, y: 400 * DEFAULT_GRAB_HEIGHT_RATIO });
      expect(settleOutcome(session)).toBe('complete');
      expect(isTurnSettled(session)).toBe(false);
      expect(currentTurnPose(session).progress).toBe(0);
    });

    it('should project the press point onto the outer edge in both directions', () => {
      expect(beginClickTurn(forward, { x: 550, y: 100 }).grab).toEqual({ x: 300, y: 100 });
      expect(beginClickTurn(backward, { x: 40, y: 500 }).grab).toEqual({ x: 300, y: 400 });
    });

    it('should advance by elapsed time from the first frame and land at progress 1', () => {
      const session = advanceTurn(beginClickTurn(forward, null), 1000);
      expect(session.motion).toMatchObject({ startTime: 1000, elapsedMs: 0 });
      const midway = advanceTurn(session, 1000 + DEFAULT_TURN_TIMING.durationMs / 2);
      const midProgress = currentTurnPose(midway).progress;
      expect(midProgress).toBeGreaterThan(0);
      expect(midProgress).toBeLessThan(1);
      expect(isTurnSettled(midway)).toBe(false);
      const done = advanceTurn(midway, 1000 + DEFAULT_TURN_TIMING.durationMs);
      expect(isTurnSettled(done)).toBe(true);
      expect(currentTurnPose(done).progress).toBe(1);
    });

    it('should reach the same pose at the same time regardless of frame rate', () => {
      const start = advanceTurn(beginClickTurn(forward, null), 0);
      let at30Hz = start;
      for (let time = 0; time <= 400; time += 1000 / 30) {
        at30Hz = advanceTurn(at30Hz, time);
      }
      at30Hz = advanceTurn(at30Hz, 400);
      let at120Hz = start;
      for (let time = 0; time <= 400; time += 1000 / 120) {
        at120Hz = advanceTurn(at120Hz, time);
      }
      at120Hz = advanceTurn(at120Hz, 400);
      expect(currentTurnPose(at30Hz)).toEqual(currentTurnPose(at120Hz));
    });

    it('should ignore drag updates', () => {
      const session = beginClickTurn(forward, null);
      expect(continueDragTurn(session, { x: 1, y: 1 }, 0)).toBe(session);
      expect(releaseDragTurn(session, { x: 1, y: 1 }, 0)).toBe(session);
      expect(cancelDragTurn(session)).toBe(session);
    });
  });

  describe('drag turn', () => {
    // 책 좌표: 오른쪽 쪽은 x∈[300, 600]. 바깥 가장자리 근처에서 눌러 왼쪽으로 끈다.
    const started = beginDragTurn(forward, { x: 590, y: 300 }, { x: 580, y: 300 }, 0);

    it('should grab the outer edge and move it only as far as the pointer moved', () => {
      expect(started.grab).toEqual({ x: 300, y: 300 });
      expect(settleOutcome(started)).toBeNull();
      expect(advanceTurn(started, 10)).toBe(started);
      // 누른 점은 모델 x = 290. 10px 끈 첫 프레임은 그만큼만(배율 300/290) 접힌다.
      expect(currentTurnPose(started).progress).toBeCloseTo(10 / (2 * 290));
      const moved = continueDragTurn(started, { x: 450, y: 320 }, 100);
      const pose = currentTurnPose(moved);
      expect(pose.progress).toBeCloseTo((290 - 150) / (2 * 290));
      expect(pose.grab.y).toBe(300);
      expect(isTurnSettled(moved)).toBe(false);
    });

    it('should reach the middle when the pointer reaches the spine wherever the drag started', () => {
      // 세로 휴대폰처럼 쪽 가운데(모델 x = 150)에서 시작한 드래그.
      const fromMiddle = beginDragTurn(forward, { x: 450, y: 200 }, { x: 440, y: 200 }, 0);
      expect(fromMiddle.grab).toEqual({ x: 300, y: 200 });
      expect(currentTurnPose(continueDragTurn(fromMiddle, { x: 300, y: 200 }, 50)).progress).toBeCloseTo(0.5);
      // 책등에 아주 가까이에서 시작해도 배율은 2배까지다.
      const nearSpine = beginDragTurn(forward, { x: 330, y: 200 }, { x: 320, y: 200 }, 0);
      expect(currentTurnPose(nearSpine).progress).toBeCloseTo((10 * 2) / 600);
      expect(MIN_DRAG_ORIGIN_RATIO).toBe(0.5);
      // 쪽 바깥(넘김 기둥의 여백)에서 시작하면 배율이 1보다 작다.
      const outside = beginDragTurn(forward, { x: 750, y: 200 }, { x: 740, y: 200 }, 0);
      expect(currentTurnPose(continueDragTurn(outside, { x: 300, y: 200 }, 50)).progress).toBeCloseTo(0.5);
    });

    it('should not fold outward when the pointer goes past the grab', () => {
      const outward = continueDragTurn(started, { x: 700, y: 300 }, 50);
      const pose = currentTurnPose(outward);
      expect(pose.progress).toBe(0);
      expect(pose.fold).toBeNull();
    });

    it('should return a slow release before the middle', () => {
      const slow = continueDragTurn(started, { x: 500, y: 300 }, 1000);
      const released = releaseDragTurn(slow, { x: 500, y: 300 }, 2000);
      expect(settleOutcome(released)).toBe('return');
      expect(released.motion.type === 'settle' && released.motion.timing.durationMs).toBeCloseTo(
        DEFAULT_TURN_TIMING.durationMs * currentTurnPose(slow).progress
      );
    });

    it('should complete a release past the middle', () => {
      const far = continueDragTurn(started, { x: 200, y: 300 }, 1000);
      expect(settleOutcome(releaseDragTurn(far, { x: 200, y: 300 }, 2000))).toBe('complete');
    });

    it('should complete a fast flick before the middle', () => {
      const flick = continueDragTurn(started, { x: 560, y: 300 }, 10);
      const released = releaseDragTurn(flick, { x: 520, y: 300 }, 40);
      expect(currentTurnPose(released).progress).toBeLessThan(0.5);
      expect(settleOutcome(released)).toBe('complete');
    });

    it('should return when the pointer is cancelled', () => {
      const cancelled = cancelDragTurn(continueDragTurn(started, { x: 300, y: 300 }, 100));
      expect(settleOutcome(cancelled)).toBe('return');
      const done = advanceTurn(advanceTurn(cancelled, 0), 10_000);
      expect(isTurnSettled(done)).toBe(true);
      expect(currentTurnPose(done).progress).toBe(0);
    });
  });

  it('should scale the settle time by the remaining progress', () => {
    expect(settleTiming(0.25, 'complete').durationMs).toBeCloseTo(DEFAULT_TURN_TIMING.durationMs * 0.75);
    expect(settleTiming(0.25, 'return').durationMs).toBeCloseTo(DEFAULT_TURN_TIMING.durationMs * 0.25);
    expect(settleTiming(1, 'complete').durationMs).toBe(0);
  });
});
