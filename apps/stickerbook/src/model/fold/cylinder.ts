import type { PageSize } from './book-frame';
import { spineEndpoints } from './spine-limit';
import type { Vec2 } from './vector';
import { addVec, distanceVec, dotVec, normalizeVec, scaleVec, subtractVec } from './vector';

/**
 * 접힘선 정렬 원통(tech-research.md 3장 원통 감기). 좌표는 모델 좌표(book-frame.ts)다.
 *
 * 종이가 평면을 떠나는 선(접선)에 평행한 축을 가진 반지름 r 원통에 종이를 감는다.
 * 접선에서 잡은 점 쪽으로 잰 거리 u에 대해:
 * - u <= 0: 평평하게 남는다.
 * - 0 < u <= πr: 각도 β = u/r만큼 감긴다. 평면 위 위치 r·sinβ, 높이 r·(1 - cosβ).
 * - u > πr: 원통을 다 돈 뒤 뒤집힌 평면이다. 평면 위 위치 πr - u, 높이 2r.
 * r = 0이면 평면 반사 접힘(reflect-fold.ts)과 같다.
 *
 * 손가락 아래 맞추기: 잡은 점 G가 위에서 볼 때 포인터 P 바로 위에 오도록 접선 위치를 고른다.
 * D = |G - P|일 때
 * - D >= πr: G가 뒤집힌 평면 위에 있다. 접선은 P에서 G 쪽으로 (D - πr)/2 떨어진 곳이다(닫힌 식).
 * - D < πr: G가 원통 위에 있다. D/r = θ - sinθ를 θ∈[0, π]에서 이분 탐색으로 풀고,
 *   접선은 P에서 G 반대쪽으로 r·sinθ 떨어진 곳이다. θ - sinθ는 [0, π]에서 단조 증가라 해가 하나다.
 * 이분 탐색은 각도 구간 폭에 r을 곱한 값 r·(high - low)(px)가 허용 오차 이하가 되면 멈춘다. 해는 구간 안에 있고
 * 답은 구간 가운데라서 각도 오차는 (high - low)/2 이하다. 그러면
 * - 접선 위치 오차 |r·sinθ - r·sinθ*| <= r·|θ - θ*| <= 허용 오차 / 2
 * - 잔차 |r·(θ - sinθ) - D| <= r·(1 - cosθ)·|θ - θ*| <= 허용 오차
 * 둘 다 허용 오차 이하다. 잔차만 보고 멈추면 D가 작을 때 θ - sinθ가 0 근처에서 평평해서 각도가 넓게 남고,
 * 포인터가 0.01px 움직일 때 접선이 몇 px씩 튄다(r = 80에서 최대 약 2px, r = 200에서 약 5px).
 * |sin a - sin b| <= |a - b|이므로 잡은 점이 포인터에서 벗어나는 거리는 잔차 이하다(spikes.md S2-1).
 *
 * 결정성: Math.sin·Math.cos는 ECMAScript 명세상 구현 근사라 엔진 사이 마지막 자리가 다를 수 있다.
 * 엔진 사이 출력 차이는 spikes.md S2-1에서 Playwright 세 엔진으로 잰다.
 */
export type CylinderWrap = {
  /** 접선에서 잰 평면 위 위치(px). 음수면 접선을 넘어 P 쪽으로 넘어왔다. */
  readonly along: number;
  /** 쪽 평면에서 잰 높이(px). */
  readonly height: number;
  /** 원통 위 각도(rad). 평평하면 0, 뒤집힌 평면이면 π. π/2를 넘으면 뒷면이 위를 본다. */
  readonly angle: number;
};

export type BisectionOptions = {
  /** px. 구간 폭(각도 구간이면 반지름을 곱한 길이)이 이 값 이하가 되면 멈춘다. */
  readonly tolerancePx: number;
  /** 반복 상한. 허용 오차를 0으로 둬도 반드시 끝나게 한다. */
  readonly maxIterations: number;
};

/**
 * 이분 탐색 기본값(제안, 엔지니어링). spikes.md S2-1 후보 "잡은 점과 포인터 거리 1 CSS px 이하"보다
 * 두 자리 작게 잡았다. 한 자세에 한 번 풀므로 정점 수와 무관하다.
 */
export const DEFAULT_CURL_SOLVE_OPTIONS: BisectionOptions = {
  tolerancePx: 0.01,
  maxIterations: 64,
};

export type CurlAngleSolution = {
  /** rad, [0, π]. */
  readonly angle: number;
  /** px. radius·(angle - sin(angle)) - distance. */
  readonly residualPx: number;
  readonly iterations: number;
};

export type CurlPose = {
  /** P에서 G를 향하는 단위 벡터. 원통 축에 수직이다. */
  readonly axis: Vec2;
  /** 접선 위의 점. 종이가 이 선에서 평면을 떠난다. */
  readonly tangentPoint: Vec2;
  readonly radius: number;
  /** 잡은 점의 원통 위 각도(rad). 뒤집힌 평면 위면 π. */
  readonly grabAngle: number;
  /** px. 잡은 점이 포인터에서 벗어나는 거리의 상한. 닫힌 식이면 0. */
  readonly residualPx: number;
  readonly iterations: number;
};

export type Vec3 = {
  readonly x: number;
  readonly y: number;
  /** 쪽 평면에서 위로 잰 높이(px). */
  readonly z: number;
};

export function wrapOnCylinder(distanceFromTangent: number, radius: number): CylinderWrap {
  if (distanceFromTangent <= 0) {
    return { along: distanceFromTangent, height: 0, angle: 0 };
  }
  if (radius <= 0) {
    return { along: -distanceFromTangent, height: 0, angle: Math.PI };
  }
  const halfTurnLength = Math.PI * radius;
  if (distanceFromTangent <= halfTurnLength) {
    const angle = distanceFromTangent / radius;
    return { along: radius * Math.sin(angle), height: radius * (1 - Math.cos(angle)), angle };
  }
  return { along: halfTurnLength - distanceFromTangent, height: 2 * radius, angle: Math.PI };
}

/**
 * D/r = θ - sinθ를 θ∈[0, π]에서 푼다. r·(구간 폭) <= 허용 오차가 되면 멈춘다.
 * D >= πr이면 θ = π에서 허용 오차 / (2r) 안쪽에 멈추고 잔차가 그만큼 남는다.
 */
export function solveCurlAngle(
  distancePx: number,
  radiusPx: number,
  options: BisectionOptions = DEFAULT_CURL_SOLVE_OPTIONS
): CurlAngleSolution {
  const residualAt = (angle: number) => radiusPx * (angle - Math.sin(angle)) - distancePx;
  let low = 0;
  let high = Math.PI;
  let angle = (low + high) / 2;
  let residualPx = residualAt(angle);
  let iterations = 0;
  while (radiusPx * (high - low) > options.tolerancePx && iterations < options.maxIterations) {
    if (residualPx < 0) {
      low = angle;
    } else {
      high = angle;
    }
    angle = (low + high) / 2;
    residualPx = residualAt(angle);
    iterations += 1;
  }
  return { angle, residualPx, iterations };
}

/** 잡은 점이 포인터 아래 오도록 원통 자세를 푼다. G와 P가 같으면 null. 반지름이 음수면 0으로 본다. */
export function solveCurlPose(
  grab: Vec2,
  pointer: Vec2,
  radius: number,
  options: BisectionOptions = DEFAULT_CURL_SOLVE_OPTIONS
): CurlPose | null {
  const axis = normalizeVec(subtractVec(grab, pointer));
  if (axis === null) {
    return null;
  }
  const effectiveRadius = Math.max(radius, 0);
  const distance = distanceVec(grab, pointer);
  const halfTurnLength = Math.PI * effectiveRadius;
  if (distance >= halfTurnLength) {
    const tangentOffset = (distance - halfTurnLength) / 2;
    return {
      axis,
      tangentPoint: addVec(pointer, scaleVec(axis, tangentOffset)),
      radius: effectiveRadius,
      grabAngle: Math.PI,
      residualPx: 0,
      iterations: 0,
    };
  }
  const solution = solveCurlAngle(distance, effectiveRadius, options);
  const tangentOffset = -effectiveRadius * Math.sin(solution.angle);
  return {
    axis,
    tangentPoint: addVec(pointer, scaleVec(axis, tangentOffset)),
    radius: effectiveRadius,
    grabAngle: solution.angle,
    residualPx: solution.residualPx,
    iterations: solution.iterations,
  };
}

/** 쪽 위의 점(접히기 전 위치)을 원통 자세에 따라 옮긴 3D 위치. */
export function curlPoint(point: Vec2, pose: CurlPose): Vec3 {
  const distanceFromTangent = dotVec(subtractVec(point, pose.tangentPoint), pose.axis);
  const wrap = wrapOnCylinder(distanceFromTangent, pose.radius);
  const planar = addVec(point, scaleVec(pose.axis, wrap.along - distanceFromTangent));
  return { x: planar.x, y: planar.y, z: wrap.height };
}

/**
 * 책등이 평평하게 남는 가장 큰 반지름(<= desiredRadius)을 이분 탐색으로 찾는다.
 * 원통 접선은 반사 접힘선보다 P 쪽에 있어서, 반지름이 크면 책등 끝이 말려 올라갈 수 있다.
 * 반지름이 커질수록 접선이 P 쪽으로 단조롭게 움직이므로 이분 탐색이 성립한다.
 * 진행도 1(P가 G의 거울 위치)에서는 책등이 접힘선 위라 반지름이 0이 되어 평평하게 착지한다
 * (tech-research.md 3장 "원통 반경은 넘김 말미에 줄여서 평평한 착지로").
 *
 * 포인터는 limitPointerToSpine을 거친 값이어야 한다. 그래야 반지름 0이 항상 해가 된다.
 * 결과는 책등이 평평한 쪽(구간의 아래쪽 끝)을 돌려준다.
 */
export function limitRadiusToSpine(
  grab: Vec2,
  pointer: Vec2,
  page: PageSize,
  desiredRadius: number,
  options: BisectionOptions = DEFAULT_CURL_SOLVE_OPTIONS
): number {
  const axis = normalizeVec(subtractVec(grab, pointer));
  if (axis === null || desiredRadius <= 0) {
    return Math.max(desiredRadius, 0);
  }
  const { top, bottom } = spineEndpoints(page);
  const farthestSpineOffset = Math.max(
    dotVec(subtractVec(top, pointer), axis),
    dotVec(subtractVec(bottom, pointer), axis)
  );
  const keepsSpineFlat = (radius: number) => {
    const pose = solveCurlPose(grab, pointer, radius, options) as CurlPose;
    return dotVec(subtractVec(pose.tangentPoint, pointer), pose.axis) >= farthestSpineOffset;
  };
  if (keepsSpineFlat(desiredRadius)) {
    return desiredRadius;
  }
  let flatRadius = 0;
  let curledRadius = desiredRadius;
  let iterations = 0;
  while (curledRadius - flatRadius > options.tolerancePx && iterations < options.maxIterations) {
    const middle = (flatRadius + curledRadius) / 2;
    if (keepsSpineFlat(middle)) {
      flatRadius = middle;
    } else {
      curledRadius = middle;
    }
    iterations += 1;
  }
  return flatRadius;
}
