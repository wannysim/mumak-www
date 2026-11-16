import { describe, expect, it } from 'vitest';

import { facingFace } from '@/test/book-faces';

import type { Quat } from '../quaternion';
import { dotQuat, IDENTITY_QUAT, multiplyQuat, quatFromAxisAngle, rotateVec3, X_AXIS, Y_AXIS } from '../quaternion';
import type { BookFace, KeyRotation } from '../rotation';
import {
  advanceKeyTurn,
  coverAngleDeg,
  DEGREES_PER_DRAG_PX,
  dragRotation,
  faceNormal,
  facingOf,
  facingOrientation,
  INITIAL_ORIENTATION,
  isKeyTurnDone,
  isTurnedAway,
  KEY_ROTATION_DURATION_MS,
  keyTurnOrientation,
  restOrientation,
  rotateByDrag,
  rotateByKeyStep,
  startKeyTurn,
} from '../rotation';

function expectSameRotation(actual: Quat, expected: Quat) {
  expect(Math.abs(dotQuat(actual, expected))).toBeCloseTo(1, 9);
}

function yaw(degrees: number): Quat {
  return quatFromAxisAngle(Y_AXIS, degrees);
}

function pitch(degrees: number): Quat {
  return quatFromAxisAngle(X_AXIS, degrees);
}

const RIGHT: KeyRotation = { axis: 'horizontal', step: 1 };
const LEFT: KeyRotation = { axis: 'horizontal', step: -1 };
const UP: KeyRotation = { axis: 'vertical', step: -1 };
const DOWN: KeyRotation = { axis: 'vertical', step: 1 };

describe('rotation', () => {
  it('should start from the closed-a pose with the front cover facing the viewer', () => {
    expectSameRotation(INITIAL_ORIENTATION, multiplyQuat(pitch(-8), yaw(-11)));
    expect(facingFace(INITIAL_ORIENTATION)).toBe('front');
  });

  describe('drag (trackball)', () => {
    it('should turn the front to the right on a rightward drag and down on a downward drag', () => {
      const right = rotateByDrag(IDENTITY_QUAT, { x: 100, y: 0 });
      expectSameRotation(right, yaw(100 * DEGREES_PER_DRAG_PX));
      const front = rotateVec3(right, faceNormal('front'));
      expect(front.x).toBeGreaterThan(0);
      const down = rotateByDrag(IDENTITY_QUAT, { x: 0, y: 100 });
      expectSameRotation(down, pitch(-100 * DEGREES_PER_DRAG_PX));
      expect(rotateVec3(down, faceNormal('front')).y).toBeGreaterThan(0);
      expect(facingOf(down, faceNormal('top'))).toBeGreaterThan(0);
    });

    it('should not rotate for a zero drag', () => {
      expect(dragRotation({ x: 0, y: 0 })).toBe(IDENTITY_QUAT);
    });

    it('should give the same result for the same drag sequence', () => {
      const deltas = [
        { x: 12, y: -3 },
        { x: -40, y: 25 },
        { x: 7, y: 90 },
      ];
      const run = () => deltas.reduce(rotateByDrag, INITIAL_ORIENTATION);
      expect(run()).toEqual(run());
    });

    it('should keep horizontal drags on the screen axis after tilting past 90 degrees (no gimbal lock)', () => {
      // 위로 100°(250px) 넘긴 뒤 오른쪽으로 90°(225px).
      const tilted = rotateByDrag(IDENTITY_QUAT, { x: 0, y: -100 / DEGREES_PER_DRAG_PX });
      const turned = rotateByDrag(tilted, { x: 90 / DEGREES_PER_DRAG_PX, y: 0 });
      // 화면을 향하던 아랫면은 화면 오른쪽(+x)으로 돈다. 화면 기준 축이라 책 자체 축과 무관하다.
      const bottomBefore = rotateVec3(tilted, faceNormal('bottom'));
      const bottomAfter = rotateVec3(turned, faceNormal('bottom'));
      expect(bottomBefore.z).toBeCloseTo(Math.sin((100 * Math.PI) / 180));
      expect(bottomAfter.x).toBeCloseTo(bottomBefore.z);
      expect(bottomAfter.y).toBeCloseTo(bottomBefore.y);
      expect(bottomAfter.z).toBeCloseTo(0);
      // 오일러 yaw였다면 뒤집힌 책 위에서 좌우가 거꾸로 돈다. 쿼터니언은 화면 Y축 회전을 그대로 앞에 곱한다.
      expectSameRotation(turned, multiplyQuat(yaw(90), tilted));
    });
  });

  describe('key steps', () => {
    it('should face the spine, back and fore edge one step at a time and keep the presentation tilt', () => {
      const spine = rotateByKeyStep(INITIAL_ORIENTATION, RIGHT);
      expectSameRotation(spine, multiplyQuat(INITIAL_ORIENTATION, yaw(90)));
      expect(facingFace(spine)).toBe('spine');
      const back = rotateByKeyStep(spine, RIGHT);
      expect(facingFace(back)).toBe('back');
      expectSameRotation(back, restOrientation('back'));
      expect(facingFace(rotateByKeyStep(INITIAL_ORIENTATION, LEFT))).toBe('fore');
    });

    it('should show the bottom with up and the top with down', () => {
      expect(facingFace(rotateByKeyStep(INITIAL_ORIENTATION, UP))).toBe('bottom');
      expect(facingFace(rotateByKeyStep(INITIAL_ORIENTATION, DOWN))).toBe('top');
    });

    it('should snap a free pose to the nearest face before stepping', () => {
      const free = multiplyQuat(INITIAL_ORIENTATION, multiplyQuat(yaw(20), pitch(-15)));
      expectSameRotation(rotateByKeyStep(free, RIGHT), rotateByKeyStep(INITIAL_ORIENTATION, RIGHT));
      let pose = INITIAL_ORIENTATION;
      for (let index = 0; index < 4; index += 1) {
        pose = rotateByKeyStep(pose, RIGHT);
      }
      expectSameRotation(pose, INITIAL_ORIENTATION);
      expect(facingFace(pose)).toBe('front');
    });

    it('should animate a key turn by elapsed time only', () => {
      const to = rotateByKeyStep(INITIAL_ORIENTATION, RIGHT);
      const turn = startKeyTurn(INITIAL_ORIENTATION, to);
      expect(isKeyTurnDone(turn)).toBe(false);
      const started = advanceKeyTurn(turn, 1000);
      expect(started).toMatchObject({ startTime: 1000, elapsedMs: 0 });
      expect(keyTurnOrientation(started)).toBe(INITIAL_ORIENTATION);
      const middle = advanceKeyTurn(started, 1000 + KEY_ROTATION_DURATION_MS / 2);
      expect(facingOf(keyTurnOrientation(middle), faceNormal('front'))).toBeLessThan(
        facingOf(INITIAL_ORIENTATION, faceNormal('front'))
      );
      const done = advanceKeyTurn(started, 1000 + KEY_ROTATION_DURATION_MS);
      expect(isKeyTurnDone(done)).toBe(true);
      expect(keyTurnOrientation(done)).toBe(to);
      expect(advanceKeyTurn(started, 900).elapsedMs).toBe(0);
    });
  });

  describe('faces', () => {
    it.each<[BookFace, Quat]>([
      ['front', IDENTITY_QUAT],
      ['spine', yaw(90)],
      ['back', yaw(180)],
      ['fore', yaw(-90)],
      ['bottom', pitch(90)],
      ['top', pitch(-90)],
      ['back', pitch(180)],
      ['front', yaw(30)],
      ['spine', yaw(60)],
    ])('should turn the %s normal most toward the screen', (face, orientation) => {
      expect(facingFace(orientation)).toBe(face);
    });

    it('should call a face turned away only when it clearly faces backwards', () => {
      expect(isTurnedAway(facingOf(INITIAL_ORIENTATION, faceNormal('front')))).toBe(false);
      expect(isTurnedAway(facingOf(INITIAL_ORIENTATION, faceNormal('back')))).toBe(true);
      expect(isTurnedAway(facingOf(yaw(100), faceNormal('front')))).toBe(false);
      expect(isTurnedAway(facingOf(yaw(120), faceNormal('front')))).toBe(true);
    });

    it('should face each cover straight on before opening and rest tilted after closing', () => {
      expect(facingOrientation('front')).toBe(IDENTITY_QUAT);
      expectSameRotation(facingOrientation('back'), yaw(180));
      expect(restOrientation('front')).toBe(INITIAL_ORIENTATION);
      expect(facingFace(restOrientation('back'))).toBe('back');
      expectSameRotation(restOrientation('back'), multiplyQuat(INITIAL_ORIENTATION, yaw(180)));
    });
  });

  it('should open the front cover to the left and the back cover the other way', () => {
    expect(coverAngleDeg('front', 1)).toBe(-180);
    expect(coverAngleDeg('front', 0.5)).toBe(-90);
    expect(coverAngleDeg('back', 1)).toBe(180);
    expect(coverAngleDeg('back', 0)).toBe(0);
  });
});
