import type { PointerSample, Vec2 } from '@/model/fold';
import {
  DEFAULT_DRAG_START_DISTANCE_PX,
  estimateVelocity,
  hasReachedDragStart,
  retainSamplesForWindow,
} from '@/model/fold';

import { SCREEN_EDGE_DRAG_GUARD_PX } from './geometry';
import { isPointInConvexPolygon } from './projection';
import type { Vec3 } from './quaternion';
import { multiplyQuat, normalizeQuat, quatFromAxisAngle } from './quaternion';
import type { Orientation } from './rotation';
import { DEGREES_PER_DRAG_PX } from './rotation';

/**
 * 닫힌 책의 화면 전체 끌기와 놓은 뒤 관성(2026-11-16 사용자 결정 B.1·B.3). 순수 함수이고 시간은 인자로 받는다.
 *
 * 끌기 판별은 fold 모델 input-priority와 같은 규칙이다:
 * - 시작 거리(8 CSS px) 이상 움직이면 끌기, 그 전에 떼면 탭이다. 끌지 않고 멀리서 뗀 누름은 효과가 없다.
 * - 처음 누른 포인터 하나만 따른다.
 * - 터치·펜은 화면 가장자리(touchGuardInsets: 좌우 Safari 뒤로·앞으로, 위아래 safe area)에서 누른 것을 받지 않는다.
 *   마우스는 화면 어디서나 받는다.
 * 누르는 순간 도는 책을 멈춘다(grab). 끌기는 지난 위치에서 움직인 만큼(delta)을 화면 기준 축에 합성한다(rotation.ts).
 * 끌지 않고 뗀 탭은 책을 원근 투영한 볼록 다각형(projection.ts projectedBookOutline) 안이면 펼침(open), 밖이면 아무 일도 없다
 * (2026-11-16 사용자 결정 B.4). 다각형을 감싼 사각형의 빈 모서리는 책이 아니다.
 *
 * 관성: 놓을 때 최근 표본으로 속도를 잰다(velocity.ts와 같은 시간 창). 각속도 ω0 = 속도 × DEGREES_PER_DRAG_PX를
 * 시간 상수 τ로 지수 감쇠시킨다. 축은 화면에 고정이라 돈 각도는 닫힌 식 θ(t) = ω0·τ·(1 - e^(-t/τ))이고,
 * 각속도가 정지 임계 ω_min에 닿는 t_stop = τ·ln(ω0/ω_min)에서 멈춘다. 경과 시간만으로 자세가 정해지므로
 * 프레임 간격(8.3·16.7·33.3ms)과 무관하게 같은 시각에 같은 자세다(tech-research.md 0장).
 */
export type SpinGesture =
  | { readonly phase: 'idle' }
  | {
      readonly phase: 'pressed' | 'dragging';
      readonly pointerId: number;
      readonly origin: Vec2;
      /** 지난번 회전에 반영한 위치. */
      readonly last: Vec2;
      readonly samples: readonly PointerSample[];
    };

export type SpinGestureEvent =
  | {
      readonly type: 'down';
      readonly pointerId: number;
      /** PointerEvent.pointerType. 'mouse'가 아니면(터치·펜·알 수 없음) 가장자리 제스처를 비켜 간다. */
      readonly pointerType: string;
      readonly point: Vec2;
      readonly time: number;
    }
  | { readonly type: 'move'; readonly pointerId: number; readonly point: Vec2; readonly time: number }
  | { readonly type: 'up'; readonly pointerId: number; readonly point: Vec2; readonly time: number }
  | { readonly type: 'cancel'; readonly pointerId: number };

type SpinEffect =
  | { readonly type: 'none' }
  /** 눌렀다. 돌던 책을 그 자리에 멈춘다. */
  | { readonly type: 'grab' }
  /** 이번에 더 돌릴 화면 이동(CSS px). */
  | { readonly type: 'drag'; readonly delta: Vec2 }
  /** 끌다가 뗐다. 마지막 이동을 반영한 뒤 velocity(px/ms)로 관성을 시작한다. */
  | { readonly type: 'release'; readonly delta: Vec2; readonly velocity: Vec2 }
  /** 끌지 않고 책 위에서 뗐다. 펼친다. */
  | { readonly type: 'open' };

export type SpinGestureStep = {
  readonly gesture: SpinGesture;
  readonly effect: SpinEffect;
};

/** 회전 영역: 화면 폭(가장자리 판정)과 지금 자세의 책 투영 다각형(탭 판정, 화면 좌표). */
/** 화면 네 변에서 안쪽으로 뺄 폭(CSS px). */
export type EdgeInsets = {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
};

export type SpinSurface = {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  /** 터치로는 회전을 시작하지 않는 가장자리(touchGuardInsets). */
  readonly touchInsets: EdgeInsets;
  readonly bookOutline: readonly Vec2[];
};

export const IDLE_SPIN_GESTURE: SpinGesture = { phase: 'idle' };

const NO_EFFECT: SpinEffect = { type: 'none' };
const ZERO: Vec2 = { x: 0, y: 0 };

/** 관성 감쇠 시간 상수(ms). 각속도가 이 시간마다 1/e로 준다. 임시, open-decisions G3 "닫힌 책 회전 범위와 감각". */
export const SPIN_DECAY_TIME_MS = 250;

/** 놓을 때 각속도 상한(deg/ms). 휙 던져도 이보다 빨리 돌지 않는다. 임시, open-decisions G3 "닫힌 책 회전 범위와 감각". */
export const MAX_SPIN_DEG_PER_MS = 1.2;

/** 이 각속도(deg/ms) 아래면 멈춘다. 놓을 때 이미 이 아래면 관성이 없다. 임시, open-decisions G3 "닫힌 책 회전 범위와 감각". */
export const SPIN_STOP_DEG_PER_MS = 0.01;

/**
 * 터치로 회전을 시작하지 않는 화면 가장자리(2026-11-16 사용자 결정, Apple HIG 반영).
 * - HIG Gestures "Avoid conflicting with gestures that access system UI": 시스템 제스처와 겹치는 사용자 제스처를 두지 않는다.
 *   앱은 시스템 제스처를 미룰(defer) 수 있지만 웹페이지에는 그 수단이 없어 비켜 가기만 한다.
 * - HIG Layout "Guides and safe areas": 위아래는 기기가 알려 주는 safe area(상태 표시줄·Dynamic Island·홈 막대 자리)만큼 뺀다.
 *   index.html이 viewport-fit=cover라 페이지가 그 밑까지 깔린다. 값이 없는 환경(데스크톱)은 0이다.
 * - 좌우는 Safari 가장자리 뒤로·앞으로 스와이프 몫으로 SCREEN_EDGE_DRAG_GUARD_PX와 safe area 중 큰 값을 뺀다
 *   (Safari 동작이라 HIG에 직접 근거는 없고 같은 원칙을 적용했다. 24px은 임시값).
 */
export function touchGuardInsets(safeArea: EdgeInsets): EdgeInsets {
  return {
    top: safeArea.top,
    right: Math.max(SCREEN_EDGE_DRAG_GUARD_PX, safeArea.right),
    bottom: safeArea.bottom,
    left: Math.max(SCREEN_EDGE_DRAG_GUARD_PX, safeArea.left),
  };
}

/** 회전을 시작할 수 있는 점인가. 마우스는 가장자리 제스처가 없어 화면 어디서나, 터치·펜은 touchInsets 안에서만. */
export function isOnSpinSurface(
  point: Vec2,
  pointerType: string,
  surface: Pick<SpinSurface, 'viewportWidth' | 'viewportHeight' | 'touchInsets'>
): boolean {
  if (pointerType === 'mouse') {
    return true;
  }
  const insets = surface.touchInsets;
  return (
    point.x >= insets.left &&
    point.x <= surface.viewportWidth - insets.right &&
    point.y >= insets.top &&
    point.y <= surface.viewportHeight - insets.bottom
  );
}

function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function withSample(samples: readonly PointerSample[], point: Vec2, time: number): PointerSample[] {
  return retainSamplesForWindow([...samples, { x: point.x, y: point.y, t: time }]);
}

export function reduceSpinGesture(
  gesture: SpinGesture,
  event: SpinGestureEvent,
  surface: SpinSurface,
  dragStartDistancePx: number = DEFAULT_DRAG_START_DISTANCE_PX
): SpinGestureStep {
  if (gesture.phase === 'idle') {
    if (event.type !== 'down' || !isOnSpinSurface(event.point, event.pointerType, surface)) {
      return { gesture, effect: NO_EFFECT };
    }
    return {
      gesture: {
        phase: 'pressed',
        pointerId: event.pointerId,
        origin: event.point,
        last: event.point,
        samples: [{ x: event.point.x, y: event.point.y, t: event.time }],
      },
      effect: { type: 'grab' },
    };
  }
  if (event.type === 'down' || event.pointerId !== gesture.pointerId) {
    return { gesture, effect: NO_EFFECT };
  }
  if (event.type === 'cancel') {
    const effect: SpinEffect =
      gesture.phase === 'dragging' ? { type: 'release', delta: ZERO, velocity: ZERO } : NO_EFFECT;
    return { gesture: IDLE_SPIN_GESTURE, effect };
  }
  const samples = withSample(gesture.samples, event.point, event.time);
  if (event.type === 'up') {
    if (gesture.phase === 'dragging') {
      return {
        gesture: IDLE_SPIN_GESTURE,
        effect: { type: 'release', delta: subtract(event.point, gesture.last), velocity: estimateVelocity(samples) },
      };
    }
    const tappedBook =
      !hasReachedDragStart(gesture.origin, event.point, dragStartDistancePx) &&
      isPointInConvexPolygon(event.point, surface.bookOutline);
    return { gesture: IDLE_SPIN_GESTURE, effect: tappedBook ? { type: 'open' } : NO_EFFECT };
  }
  if (gesture.phase === 'pressed' && !hasReachedDragStart(gesture.origin, event.point, dragStartDistancePx)) {
    return { gesture: { ...gesture, samples }, effect: NO_EFFECT };
  }
  return {
    gesture: { ...gesture, phase: 'dragging', last: event.point, samples },
    effect: { type: 'drag', delta: subtract(event.point, gesture.last) },
  };
}

/** 놓은 뒤 관성. base는 놓은 순간 자세, axis는 화면 축, speed는 처음 각속도(deg/ms). */
export type Spin = {
  readonly base: Orientation;
  readonly axis: Vec3;
  readonly speed: number;
  /** 지난 프레임 시각. 아직 그리지 않았으면 null. */
  readonly lastTime: number | null;
  readonly elapsedMs: number;
};

/** 놓을 때의 화면 속도(px/ms)로 관성을 시작한다. 정지 임계 이하면 null(그 자리에 멈춘다). */
export function startSpin(base: Orientation, velocity: Vec2): Spin | null {
  const pixelSpeed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
  const speed = Math.min(pixelSpeed * DEGREES_PER_DRAG_PX, MAX_SPIN_DEG_PER_MS);
  if (speed <= SPIN_STOP_DEG_PER_MS) {
    return null;
  }
  return { base, axis: { x: -velocity.y, y: velocity.x, z: 0 }, speed, lastTime: null, elapsedMs: 0 };
}

/** 각속도가 정지 임계에 닿는 시각(ms). */
export function spinStopMs(spin: Spin): number {
  return SPIN_DECAY_TIME_MS * Math.log(spin.speed / SPIN_STOP_DEG_PER_MS);
}

/** 놓은 뒤 elapsedMs 동안 돈 각도(deg). 멈춘 뒤로는 늘지 않는다. */
export function spinAngleAt(spin: Spin, elapsedMs: number): number {
  const time = Math.min(Math.max(elapsedMs, 0), spinStopMs(spin));
  return spin.speed * SPIN_DECAY_TIME_MS * (1 - Math.exp(-time / SPIN_DECAY_TIME_MS));
}

function isSpinDoneAt(spin: Spin, elapsedMs: number): boolean {
  return elapsedMs >= spinStopMs(spin);
}

export function spinOrientation(spin: Spin): Orientation {
  const angle = spinAngleAt(spin, spin.elapsedMs);
  // 첫 프레임(0°)은 놓은 자세 그대로 둔다(정규화 반올림으로 값이 흔들리지 않게).
  return angle === 0 ? spin.base : normalizeQuat(multiplyQuat(quatFromAxisAngle(spin.axis, angle), spin.base));
}

/** 프레임 간격 dtMs만큼 진행(step(state, dt) → state). 자세는 누적 경과 시간의 닫힌 식이라 간격과 무관하다. */
export function stepSpin(spin: Spin, dtMs: number): Spin {
  return { ...spin, elapsedMs: spin.elapsedMs + Math.max(dtMs, 0) };
}

/** 프레임 시각으로 진행. 첫 프레임은 놓은 자세 그대로 두고, 그 뒤로는 지난 프레임과의 간격만큼 stepSpin한다. */
export function advanceSpin(spin: Spin, time: number): Spin {
  if (spin.lastTime === null) {
    return { ...spin, lastTime: time };
  }
  return stepSpin({ ...spin, lastTime: Math.max(spin.lastTime, time) }, time - spin.lastTime);
}

export function isSpinDone(spin: Spin): boolean {
  return isSpinDoneAt(spin, spin.elapsedMs);
}
