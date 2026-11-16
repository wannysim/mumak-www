/**
 * 2D 벡터 연산. 단위는 CSS px다.
 *
 * 결정성: 길이는 `Math.hypot` 대신 `Math.sqrt(x * x + y * y)`로 잰다. ECMAScript 명세에서
 * `Math.sqrt`는 IEEE 754 정확 반올림이고 `Math.hypot`은 구현 근사라서 엔진마다 마지막 자리가 다를 수 있다.
 * 모든 함수는 새 객체를 돌려주고 인자를 바꾸지 않는다.
 */
export type Vec2 = {
  readonly x: number;
  readonly y: number;
};

export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function addVec(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subtractVec(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scaleVec(v: Vec2, factor: number): Vec2 {
  return { x: v.x * factor, y: v.y * factor };
}

export function dotVec(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function lengthSquaredVec(v: Vec2): number {
  return v.x * v.x + v.y * v.y;
}

export function lengthVec(v: Vec2): number {
  return Math.sqrt(lengthSquaredVec(v));
}

export function distanceVec(a: Vec2, b: Vec2): number {
  return lengthVec(subtractVec(a, b));
}

/** 길이가 0이면 null을 돌려준다. 방향이 없는 벡터를 조용히 (0, 0)으로 바꾸지 않기 위해서다. */
export function normalizeVec(v: Vec2): Vec2 | null {
  const length = lengthVec(v);
  if (length === 0) {
    return null;
  }
  return { x: v.x / length, y: v.y / length };
}

/** t=0이면 a, t=1이면 b. 범위 밖 t도 그대로 외삽한다. */
export function lerpVec(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
