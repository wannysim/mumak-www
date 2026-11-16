import type { Vec2 } from '@/model/fold';

import { OPEN_EASING } from './easing';
import type { Quat, Vec3 } from './quaternion';
import {
  conjugateQuat,
  IDENTITY_QUAT,
  multiplyQuat,
  nearestCubeOrientation,
  normalizeQuat,
  quatFromAxisAngle,
  rotateVec3,
  slerpQuat,
  X_AXIS,
  Y_AXIS,
} from './quaternion';

/**
 * 닫힌 책의 자세(orientation). 쿼터니언 하나로 두고 CSS에는 matrix3d로 넘긴다(quaternion.ts).
 *
 * - 자유 회전: 위아래 제한이 없다. 끌기는 화면 기준 축에 변화량을 합성한다(트랙볼). 앞면이 위를 향해도 좌우 끌기는
 *   화면 좌우로 돈다(짐벌 락 없음). 2026-11-16 사용자 결정 B.2.
 * - 오른쪽으로 끌면 앞면이 오른쪽으로(책등이 보이는 쪽으로), 아래로 끌면 앞면이 아래로(윗면이 보이는 쪽으로) 돈다.
 * - 면 판정은 회전 행렬로 돌린 면 법선의 z(보는 사람 쪽 성분)로 한다.
 */
export type Orientation = Quat;

/** 덮을 때 위에 오는 표지. 'front'면 닫힌 책 앞면이, 'back'이면 뒷면(명함 뒷면)이 보인다. */
export type CoverSide = 'front' | 'back';

export type BookFace = 'front' | 'spine' | 'back' | 'fore' | 'top' | 'bottom';

/**
 * 닫힌 책을 쉬게 둘 때의 기울기(시안 closed-a `rotateX(-8deg) rotateY(-11deg)`). 첫 화면, 덮은 뒤, 키보드 회전이 쉬는 자세에
 * 같은 기울기를 건다. 임시, open-decisions G0 "닫힌 책 형태"·G3 "닫힌 책 회전 범위와 감각".
 */
const PRESENTATION_PITCH_DEG = -8;
const PRESENTATION_YAW_DEG = -11;
const PRESENTATION_TILT: Quat = multiplyQuat(
  quatFromAxisAngle(X_AXIS, PRESENTATION_PITCH_DEG),
  quatFromAxisAngle(Y_AXIS, PRESENTATION_YAW_DEG)
);

/** 뒷면이 정면을 보는 자세. 세로축(책등 방향)으로 반 바퀴. */
const BACK_TURN: Quat = quatFromAxisAngle(Y_AXIS, 180);

/** 첫 화면 자세. 앞면이 보는 사람 쪽이다. */
export const INITIAL_ORIENTATION: Orientation = PRESENTATION_TILT;

/** 끌기 1 CSS px당 회전 각도. 임시, open-decisions G3 "닫힌 책 회전 범위와 감각". */
export const DEGREES_PER_DRAG_PX = 0.4;

/** 키보드 화살표 한 번에 도는 각도와 시간. 임시, tech-research.md 7장 U1·open-decisions G3 "닫힌 책 회전 범위와 감각". */
const KEY_ROTATION_STEP_DEG = 90;
export const KEY_ROTATION_DURATION_MS = 400;

/** 표지 판이 완전히 열렸을 때 책등을 축으로 돈 각도. 정해진 기하(펼친 책 옆 쪽 자리에 눕는다). */
const COVER_OPEN_DEG = 180;

/**
 * 면이 보는 사람에게서 돌아섰다고 볼 경계(면 법선의 z). 이보다 더 돌아선 면은 숨긴다.
 * 3D 합성 없이 면을 평면으로 겹쳐 그리는 환경(Playwright 헤드리스 WebKit에서 관찰)에서도 DOM 순서상 뒤의 면이
 * 뒤집힌 채 앞에 그려지지 않게 하는 보조 장치다. 모서리에 가까운 각도는 원근 때문에 보일 수 있어 backface-visibility에 맡긴다.
 */
const TURNED_AWAY_FACING = -0.2;

const FACE_NORMALS: Readonly<Record<BookFace, Vec3>> = {
  front: { x: 0, y: 0, z: 1 },
  back: { x: 0, y: 0, z: -1 },
  spine: { x: -1, y: 0, z: 0 },
  fore: { x: 1, y: 0, z: 0 },
  top: { x: 0, y: -1, z: 0 },
  bottom: { x: 0, y: 1, z: 0 },
};

/** 표지 면이 정면을 보는 자세(펼치기 직전·덮은 직후). */
export function facingOrientation(side: CoverSide): Orientation {
  return side === 'front' ? IDENTITY_QUAT : BACK_TURN;
}

/**
 * 덮은 뒤 쉬는 자세. 앞표지로 덮으면 첫 화면 자세, 뒤표지로 덮으면 같은 기울기로 뒷면을 보인다.
 * 임시, open-decisions G3 "닫힌 책 회전 범위와 감각".
 */
export function restOrientation(side: CoverSide): Orientation {
  return side === 'front' ? PRESENTATION_TILT : normalizeQuat(multiplyQuat(PRESENTATION_TILT, BACK_TURN));
}

/** 화면에서 delta(CSS px)만큼 끌 때 더할 회전. 축은 끈 방향에 수직인 화면 축이다. */
export function dragRotation(delta: Vec2): Quat {
  const distance = Math.sqrt(delta.x * delta.x + delta.y * delta.y);
  return quatFromAxisAngle({ x: -delta.y, y: delta.x, z: 0 }, distance * DEGREES_PER_DRAG_PX);
}

/** 지금 자세에 화면 기준 끌기 회전을 더한다. */
export function rotateByDrag(orientation: Orientation, delta: Vec2): Orientation {
  // 움직이지 않았으면 그대로 둔다(정규화 반올림으로 자세가 흔들리지 않게).
  if (delta.x === 0 && delta.y === 0) {
    return orientation;
  }
  return normalizeQuat(multiplyQuat(dragRotation(delta), orientation));
}

/** 키보드 회전. 'horizontal' 1은 →(오른쪽으로 끈 것과 같다), 'vertical' 1은 ↓(아래로 끈 것과 같다). */
export type KeyRotation = {
  readonly axis: 'horizontal' | 'vertical';
  readonly step: 1 | -1;
};

/**
 * 한 면이 정면에 서도록 맞춘 뒤 화면 축으로 90° 돈다. 기울기(PRESENTATION_TILT)를 빼고 가장 가까운 축 정렬 자세를 찾아
 * 돌린 다음 기울기를 다시 건다. 그래서 몇 번을 눌러도 오차가 쌓이지 않고 늘 같은 기울기로 한 면을 보인다.
 */
export function rotateByKeyStep(orientation: Orientation, rotation: KeyRotation): Orientation {
  const aligned = nearestCubeOrientation(multiplyQuat(conjugateQuat(PRESENTATION_TILT), orientation));
  const direction = rotation.axis === 'horizontal' ? { x: rotation.step, y: 0 } : { x: 0, y: rotation.step };
  const turn = quatFromAxisAngle({ x: -direction.y, y: direction.x, z: 0 }, KEY_ROTATION_STEP_DEG);
  return normalizeQuat(multiplyQuat(PRESENTATION_TILT, multiplyQuat(turn, aligned)));
}

/** 키보드 회전 전환. 경과 시간으로만 자세를 정한다(주사율 무관). */
export type KeyTurn = {
  readonly from: Orientation;
  readonly to: Orientation;
  /** 첫 프레임 시각. 아직 그리지 않았으면 null. */
  readonly startTime: number | null;
  readonly elapsedMs: number;
};

export function startKeyTurn(from: Orientation, to: Orientation): KeyTurn {
  return { from, to, startTime: null, elapsedMs: 0 };
}

export function advanceKeyTurn(turn: KeyTurn, time: number): KeyTurn {
  const startTime = turn.startTime ?? time;
  return { ...turn, startTime, elapsedMs: Math.max(time - startTime, 0) };
}

/** 이징은 이전 CSS 전환(400ms cubic-bezier(.16,1,.3,1))과 같다. */
export function keyTurnOrientation(turn: KeyTurn): Orientation {
  return slerpQuat(turn.from, turn.to, OPEN_EASING(Math.min(turn.elapsedMs / KEY_ROTATION_DURATION_MS, 1)));
}

export function isKeyTurnDone(turn: KeyTurn): boolean {
  return turn.startTime !== null && turn.elapsedMs >= KEY_ROTATION_DURATION_MS;
}

export function faceNormal(face: BookFace): Vec3 {
  return FACE_NORMALS[face];
}

/** 법선 normal(책 좌표)이 돌린 뒤 보는 사람 쪽을 향하는 정도. 1이면 정면, -1이면 완전히 돌아섰다. */
export function facingOf(orientation: Orientation, normal: Vec3): number {
  return rotateVec3(orientation, normal).z;
}

export function isTurnedAway(facing: number): boolean {
  return facing < TURNED_AWAY_FACING;
}

/** 표지 판이 열린 정도(0 닫힘 .. 1 다 열림) → 책등을 축으로 한 CSS rotateY 각도. 앞표지는 왼쪽(-)으로, 뒤표지는 반대로 연다. */
export function coverAngleDeg(side: CoverSide, coverOpen: number): number {
  return (side === 'front' ? -COVER_OPEN_DEG : COVER_OPEN_DEG) * coverOpen;
}
