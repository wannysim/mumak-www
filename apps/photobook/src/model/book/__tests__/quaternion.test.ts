import { describe, expect, it } from 'vitest';

import type { Quat, Vec3 } from '../quaternion';
import {
  angleBetweenQuat,
  dotQuat,
  IDENTITY_QUAT,
  multiplyQuat,
  normalizeQuat,
  quatFromAxisAngle,
  quatToMatrix,
  rotateVec3,
  slerpQuat,
  toCssMatrix3d,
  X_AXIS,
  Y_AXIS,
} from '../quaternion';

/** 두 점 사이 거리. */
function gap(actual: Vec3, expected: Vec3): number {
  return Math.sqrt((actual.x - expected.x) ** 2 + (actual.y - expected.y) ** 2 + (actual.z - expected.z) ** 2);
}

/** 두 자세의 차이. 0이면 같은 자세다(q와 -q는 같은 자세라 내적의 절댓값을 본다). */
function rotationGap(actual: Quat, expected: Quat): number {
  return 1 - Math.abs(dotQuat(actual, expected));
}

/** CSS rotateX·rotateY 행렬(MDN 정의)을 그대로 적은 것. 쿼터니언 행렬이 CSS와 같은 방향인지 대조한다. */
function cssRotateX(degrees: number, v: Vec3): Vec3 {
  const a = (degrees * Math.PI) / 180;
  return { x: v.x, y: v.y * Math.cos(a) - v.z * Math.sin(a), z: v.y * Math.sin(a) + v.z * Math.cos(a) };
}

function cssRotateY(degrees: number, v: Vec3): Vec3 {
  const a = (degrees * Math.PI) / 180;
  return { x: v.x * Math.cos(a) + v.z * Math.sin(a), y: v.y, z: -v.x * Math.sin(a) + v.z * Math.cos(a) };
}

describe('quaternion', () => {
  const point: Vec3 = { x: 0.3, y: -0.7, z: 1.1 };

  it('should rotate like the CSS rotate functions, applying the right factor first', () => {
    expect(gap(rotateVec3(quatFromAxisAngle(Y_AXIS, 37), point), cssRotateY(37, point))).toBeLessThan(1e-10);
    expect(gap(rotateVec3(quatFromAxisAngle(X_AXIS, -8), point), cssRotateX(-8, point))).toBeLessThan(1e-10);
    // CSS `rotateX(-8deg) rotateY(-11deg)`는 rotateY를 먼저 적용한다.
    const combined = multiplyQuat(quatFromAxisAngle(X_AXIS, -8), quatFromAxisAngle(Y_AXIS, -11));
    expect(gap(rotateVec3(combined, point), cssRotateX(-8, cssRotateY(-11, point)))).toBeLessThan(1e-10);
  });

  it('should treat a zero axis as no rotation and normalize any axis length', () => {
    expect(quatFromAxisAngle({ x: 0, y: 0, z: 0 }, 90)).toBe(IDENTITY_QUAT);
    expect(rotationGap(quatFromAxisAngle({ x: 0, y: 5, z: 0 }, 30), quatFromAxisAngle(Y_AXIS, 30))).toBeLessThan(1e-10);
    expect(normalizeQuat({ w: 0, x: 0, y: 0, z: 0 })).toBe(IDENTITY_QUAT);
    const normalized = normalizeQuat({ w: 2, x: 0, y: 0, z: 0 });
    expect(normalized).toEqual(IDENTITY_QUAT);
  });

  it('should measure the shortest angle between orientations', () => {
    expect(angleBetweenQuat(IDENTITY_QUAT, quatFromAxisAngle(Y_AXIS, 90))).toBeCloseTo(90);
    expect(angleBetweenQuat(IDENTITY_QUAT, quatFromAxisAngle(Y_AXIS, 270))).toBeCloseTo(90);
    expect(angleBetweenQuat(IDENTITY_QUAT, quatFromAxisAngle(Y_AXIS, 360))).toBeCloseTo(0);
    const q = quatFromAxisAngle(X_AXIS, 10);
    expect(angleBetweenQuat(q, q)).toBe(0);
  });

  describe('slerp', () => {
    const from = quatFromAxisAngle(Y_AXIS, 0);
    const to = quatFromAxisAngle(Y_AXIS, 120);

    it('should return the end points exactly', () => {
      expect(slerpQuat(from, to, 0)).toBe(from);
      expect(slerpQuat(from, to, 1)).toBe(to);
      expect(slerpQuat(from, to, -1)).toBe(from);
      expect(slerpQuat(from, to, 2)).toBe(to);
    });

    it('should move at constant angular speed along the shortest path', () => {
      expect(rotationGap(slerpQuat(from, to, 0.25), quatFromAxisAngle(Y_AXIS, 30))).toBeLessThan(1e-10);
      expect(rotationGap(slerpQuat(from, to, 0.5), quatFromAxisAngle(Y_AXIS, 60))).toBeLessThan(1e-10);
      // 270°는 -90°로 짧게 돈다.
      expect(
        rotationGap(slerpQuat(from, quatFromAxisAngle(Y_AXIS, 270), 0.5), quatFromAxisAngle(Y_AXIS, -45))
      ).toBeLessThan(1e-10);
    });

    it('should stay stable for nearly equal orientations', () => {
      const near = quatFromAxisAngle(Y_AXIS, 0.5);
      expect(rotationGap(slerpQuat(from, near, 0.5), quatFromAxisAngle(Y_AXIS, 0.25))).toBeLessThan(1e-10);
    });
  });

  it('should write a column-major CSS matrix3d without negative zeros', () => {
    expect(toCssMatrix3d(IDENTITY_QUAT)).toBe('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)');
    const m = quatToMatrix(quatFromAxisAngle(Y_AXIS, 90));
    // rotateY(90deg): 첫 열은 (cos, 0, -sin) = (0, 0, -1).
    expect(m[6]).toBeCloseTo(-1);
    expect(toCssMatrix3d(quatFromAxisAngle(Y_AXIS, 90))).toBe(
      'matrix3d(0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1)'
    );
  });
});
