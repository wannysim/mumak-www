/**
 * 쿼터니언과 3D 벡터. 닫힌 책의 자세를 오일러 각 없이 다뤄 짐벌 락이 없게 한다. 순수 함수이고 플랫폼 API를 쓰지 않는다.
 *
 * - 좌표계는 CSS 3D와 같다: x 오른쪽, y 아래, z 보는 사람 쪽. 각도 인자는 deg다.
 * - 축-각 회전과 행렬은 CSS 회전 함수와 같은 방향이다. 예: quatFromAxisAngle(Y축, a)는 CSS `rotateY(a)`와 같은 행렬이다.
 * - 점 v의 회전은 R(q)·v다. multiplyQuat(b, a)는 a를 먼저, b를 나중에 적용한다(행렬 R(b)·R(a)).
 *   CSS `transform: A B`도 B를 먼저 적용하는 행렬 A·B라서, `rotateX(p) rotateY(y)`는 multiplyQuat(X(p), Y(y))와 같다.
 * - 길이는 vector.ts와 같은 이유(엔진마다 같은 값)로 Math.hypot 대신 Math.sqrt로 잰다.
 * - 모든 함수는 새 객체를 돌려주고 인자를 바꾸지 않는다.
 */
export type Vec3 = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

export type Quat = {
  readonly w: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

/** 3×3 회전 행렬, 행 우선(row-major): [r00, r01, r02, r10, r11, r12, r20, r21, r22]. */
export type Matrix3 = readonly [number, number, number, number, number, number, number, number, number];

export const IDENTITY_QUAT: Quat = { w: 1, x: 0, y: 0, z: 0 };

export const X_AXIS: Vec3 = { x: 1, y: 0, z: 0 };
export const Y_AXIS: Vec3 = { x: 0, y: 1, z: 0 };

const DEGREES_TO_RADIANS = Math.PI / 180;

/** 두 쿼터니언이 거의 같은 방향이라 선형 보간으로 충분하다고 볼 내적. 이보다 크면 sin(θ)가 0에 가까워 나눗셈이 불안정하다. */
const SLERP_LINEAR_DOT = 0.9995;

const CSS_MATRIX_DIGITS = 6;

function vectorLength(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/** 축(길이 무관)을 중심으로 degrees만큼 도는 회전. 축 길이가 0이면 회전 없음. */
export function quatFromAxisAngle(axis: Vec3, degrees: number): Quat {
  const length = vectorLength(axis);
  if (length === 0) {
    return IDENTITY_QUAT;
  }
  const half = (degrees * DEGREES_TO_RADIANS) / 2;
  const scale = Math.sin(half) / length;
  return { w: Math.cos(half), x: axis.x * scale, y: axis.y * scale, z: axis.z * scale };
}

/** Hamilton 곱 a·b. b를 먼저, a를 나중에 적용하는 회전이다. */
export function multiplyQuat(a: Quat, b: Quat): Quat {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

/** 단위 길이로 맞춘다. 곱을 거듭하며 쌓이는 반올림 오차를 지운다. 길이가 0이면 회전 없음으로 본다. */
export function normalizeQuat(q: Quat): Quat {
  const length = Math.sqrt(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
  if (length === 0) {
    return IDENTITY_QUAT;
  }
  return { w: q.w / length, x: q.x / length, y: q.y / length, z: q.z / length };
}

export function dotQuat(a: Quat, b: Quat): number {
  return a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z;
}

/** 두 자세 사이의 가장 짧은 회전 각도(deg, [0, 180]). q와 -q는 같은 자세다. */
export function angleBetweenQuat(a: Quat, b: Quat): number {
  const dot = Math.min(Math.abs(dotQuat(a, b)), 1);
  return (2 * Math.acos(dot)) / DEGREES_TO_RADIANS;
}

/**
 * 구면 선형 보간. 가장 짧은 길로 돈다(내적이 음수면 b를 뒤집어 같은 자세의 가까운 쪽을 쓴다).
 * t ≤ 0이면 a, t ≥ 1이면 b를 그대로 돌려준다.
 */
export function slerpQuat(a: Quat, b: Quat, t: number): Quat {
  if (t <= 0) {
    return a;
  }
  if (t >= 1) {
    return b;
  }
  const rawDot = dotQuat(a, b);
  const sign = rawDot < 0 ? -1 : 1;
  const dot = rawDot * sign;
  const target = { w: b.w * sign, x: b.x * sign, y: b.y * sign, z: b.z * sign };
  if (dot > SLERP_LINEAR_DOT) {
    return normalizeQuat({
      w: a.w + (target.w - a.w) * t,
      x: a.x + (target.x - a.x) * t,
      y: a.y + (target.y - a.y) * t,
      z: a.z + (target.z - a.z) * t,
    });
  }
  const theta = Math.acos(dot);
  const sinTheta = Math.sin(theta);
  const fromWeight = Math.sin((1 - t) * theta) / sinTheta;
  const toWeight = Math.sin(t * theta) / sinTheta;
  return normalizeQuat({
    w: a.w * fromWeight + target.w * toWeight,
    x: a.x * fromWeight + target.x * toWeight,
    y: a.y * fromWeight + target.y * toWeight,
    z: a.z * fromWeight + target.z * toWeight,
  });
}

export function quatToMatrix(q: Quat): Matrix3 {
  const { w, x, y, z } = q;
  return [
    1 - 2 * (y * y + z * z),
    2 * (x * y - w * z),
    2 * (x * z + w * y),
    2 * (x * y + w * z),
    1 - 2 * (x * x + z * z),
    2 * (y * z - w * x),
    2 * (x * z - w * y),
    2 * (y * z + w * x),
    1 - 2 * (x * x + y * y),
  ];
}

export function applyMatrix3(m: Matrix3, v: Vec3): Vec3 {
  return {
    x: m[0] * v.x + m[1] * v.y + m[2] * v.z,
    y: m[3] * v.x + m[4] * v.y + m[5] * v.z,
    z: m[6] * v.x + m[7] * v.y + m[8] * v.z,
  };
}

export function rotateVec3(q: Quat, v: Vec3): Vec3 {
  return applyMatrix3(quatToMatrix(q), v);
}

function roundForCss(value: number): number {
  const factor = 10 ** CSS_MATRIX_DIGITS;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** CSS `matrix3d()`. CSS는 열 우선(column-major)이라 행렬을 전치해 적는다. */
export function toCssMatrix3d(q: Quat): string {
  const m = quatToMatrix(q);
  const columns = [m[0], m[3], m[6], 0, m[1], m[4], m[7], 0, m[2], m[5], m[8], 0, 0, 0, 0, 1];
  return `matrix3d(${columns.map(roundForCss).join(', ')})`;
}
