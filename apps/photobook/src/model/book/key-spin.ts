import type { Vec2 } from '@/model/fold';

import { multiplyQuat, normalizeQuat } from './quaternion';
import type { Orientation } from './rotation';
import { screenRotation } from './rotation';
import { SPIN_DECAY_TIME_MS } from './spin';

/**
 * 닫힌 책의 화살표 키 회전(2026-11-16 사용자 결정: 90°씩 끊어 돌지 않고 누르는 동안 천천히 돈다).
 *
 * - 누르는 동안 화면 기준 축으로 KEY_SPIN_DEG_PER_MS로 돈다. 방향은 끌기와 같다: →는 오른쪽으로, ↓는 아래로 끈 것이다.
 *   두 화살표를 함께 누르면 대각선으로 같은 빠르기로 돌고, 반대 화살표는 서로 지운다(keyboard.ts arrowDirection).
 * - 빠르기는 관성과 같은 시간 상수(SPIN_DECAY_TIME_MS)로 목표에 다가간다. 누르면 부드럽게 출발하고, 다 떼면 그 빠르기로
 *   관성(spin.ts spinFromVelocity)에 넘겨 돌다 멈춘다. 관성으로 돌던 중에 누르면 그 빠르기에서 이어 간다(book-state.ts).
 * - 누른 키 조합이 바뀔 때마다 지금 자세·빠르기에서 구간을 새로 시작한다. 구간 안에서는 경과 시간의 닫힌 식이라
 *   프레임 간격과 무관하게 같은 시각에 같은 자세다(tech-research.md 0장). τ = SPIN_DECAY_TIME_MS, T = target, v0 = initial:
 *     빠르기 v(t) = T·(1 - e^(-t/τ)) + v0·e^(-t/τ)
 *     돈 각도 θ(t) = T·(t - τ(1 - e^(-t/τ))) + v0·τ(1 - e^(-t/τ))
 *   T와 v0의 방향이 다르면(돌던 중 다른 방향 키) 두 회전을 차례로 합성한다. 실제 적분과 2차 오차가 있지만 결정적이다.
 * - 동작 줄이기면 initial을 target과 같게 두어 가속 없이 누르는 동안만 돌고, 떼면 그 자리에 선다(끌기가 손만 따르는 것과 같다).
 *
 * 각속도는 끄는 방향 벡터이고 길이가 deg/ms다(rotation.ts screenRotation과 같은 방향 규칙).
 */
export type KeySpin = {
  /** 구간을 시작한 자세. */
  readonly base: Orientation;
  /** 구간을 시작할 때의 각속도. */
  readonly initial: Vec2;
  /** 누른 키가 정한 각속도. 0이 아니다(다 떼면 관성이나 정지로 넘긴다). */
  readonly target: Vec2;
  /** 지난 프레임 시각. 아직 그리지 않았으면 null. */
  readonly lastTime: number | null;
  readonly elapsedMs: number;
};

/**
 * 누르는 동안의 각속도(deg/ms). 0.06은 초당 60°라 90°를 도는 데 출발 가속을 더해 약 1.75초다.
 * 임시, open-decisions G3 "닫힌 책 회전 범위와 감각".
 */
export const KEY_SPIN_DEG_PER_MS = 0.06;

const ZERO: Vec2 = { x: 0, y: 0 };

function scale(vector: Vec2, factor: number): Vec2 {
  return { x: vector.x * factor, y: vector.y * factor };
}

/** 누른 화살표 방향(성분 -1·0·1의 합) → 목표 각속도. 대각선도 같은 빠르기다. 방향이 없으면 0. */
export function keySpinTarget(direction: Vec2): Vec2 {
  const size = Math.hypot(direction.x, direction.y);
  return size === 0 ? ZERO : scale(direction, KEY_SPIN_DEG_PER_MS / size);
}

/** 구간 시작. 동작 줄이기면 가속 없이 바로 목표 빠르기다. */
export function startKeySpin(
  base: Orientation,
  current: { readonly velocity: Vec2; readonly lastTime: number | null },
  target: Vec2,
  reducedMotion: boolean
): KeySpin {
  return { base, initial: reducedMotion ? target : current.velocity, target, lastTime: current.lastTime, elapsedMs: 0 };
}

/** 구간을 시작한 뒤 지금까지 출발 가속·관성이 덜어 낸 시간(ms): τ(1 - e^(-t/τ)). */
function settledMs(elapsedMs: number): number {
  return SPIN_DECAY_TIME_MS * (1 - Math.exp(-elapsedMs / SPIN_DECAY_TIME_MS));
}

export function keySpinVelocity(spin: KeySpin): Vec2 {
  const remaining = Math.exp(-spin.elapsedMs / SPIN_DECAY_TIME_MS);
  return {
    x: spin.target.x * (1 - remaining) + spin.initial.x * remaining,
    y: spin.target.y * (1 - remaining) + spin.initial.y * remaining,
  };
}

export function keySpinOrientation(spin: KeySpin): Orientation {
  if (spin.elapsedMs === 0) {
    // 구간 첫 순간은 시작 자세 그대로 둔다(정규화 반올림으로 값이 흔들리지 않게).
    return spin.base;
  }
  const settled = settledMs(spin.elapsedMs);
  const coasting = screenRotation(scale(spin.initial, settled));
  const driven = screenRotation(scale(spin.target, spin.elapsedMs - settled));
  return normalizeQuat(multiplyQuat(driven, multiplyQuat(coasting, spin.base)));
}

/** 프레임 시각으로 진행. 첫 프레임은 시각만 적고, 그 뒤로는 지난 프레임과의 간격만큼 경과 시간을 늘린다. */
export function advanceKeySpin(spin: KeySpin, time: number): KeySpin {
  if (spin.lastTime === null) {
    return { ...spin, lastTime: time };
  }
  return {
    ...spin,
    lastTime: Math.max(spin.lastTime, time),
    elapsedMs: spin.elapsedMs + Math.max(time - spin.lastTime, 0),
  };
}
