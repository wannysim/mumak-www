import { describe, expect, it } from 'vitest';

import { facingFace } from '@/test/book-faces';

import type { Quat } from '../quaternion';
import { dotQuat, IDENTITY_QUAT, multiplyQuat, quatFromAxisAngle, rotateVec3, X_AXIS, Y_AXIS } from '../quaternion';
import type { BookFace } from '../rotation';
import {
  coverAngleDeg,
  DEGREES_PER_DRAG_PX,
  dragRotation,
  faceNormal,
  facingOf,
  facingOrientation,
  INITIAL_ORIENTATION,
  isTurnedAway,
  restOrientation,
  rotateByDrag,
  screenRotation,
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

  describe('screen rotation', () => {
    it('should turn the way the given drag direction points, by its length in degrees', () => {
      // 오른쪽으로 90°면 책등이, 위로 90°면 아랫면이, 아래로 90°면 윗면이 정면에 온다(화살표 키와 같은 방향).
      expectSameRotation(screenRotation({ x: 90, y: 0 }), yaw(90));
      expect(facingFace(multiplyQuat(screenRotation({ x: 90, y: 0 }), INITIAL_ORIENTATION))).toBe('spine');
      expect(facingFace(multiplyQuat(screenRotation({ x: -90, y: 0 }), INITIAL_ORIENTATION))).toBe('fore');
      expect(facingFace(multiplyQuat(screenRotation({ x: 0, y: -90 }), INITIAL_ORIENTATION))).toBe('bottom');
      expect(facingFace(multiplyQuat(screenRotation({ x: 0, y: 90 }), INITIAL_ORIENTATION))).toBe('top');
      expect(screenRotation({ x: 0, y: 0 })).toBe(IDENTITY_QUAT);
    });

    it('should match a drag scaled by the degrees per pixel', () => {
      const drag = dragRotation({ x: 30, y: -40 });
      const scaled = screenRotation({ x: 30 * DEGREES_PER_DRAG_PX, y: -40 * DEGREES_PER_DRAG_PX });
      expect(Math.abs(dotQuat(drag, scaled))).toBeCloseTo(1, 9);
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
