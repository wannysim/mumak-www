import type { Vec2 } from '@/model/fold';
import { DEFAULT_DRAG_START_DISTANCE_PX, hasReachedDragStart } from '@/model/fold';

/**
 * 닫힌 책 회전. 각도 단위는 deg이고 CSS `rotateX(pitch) rotateY(yaw)`에 그대로 들어간다.
 *
 * - yaw가 커지면 앞면이 오른쪽으로 돈다(오른쪽으로 끌기와 같은 방향). yaw 90이면 책등이 보인다.
 * - pitch가 음수면 윗면이 보는 사람 쪽으로 기운다(위에서 내려다보는 시점).
 * - yaw는 제한 없이 누적한다. 면 판정은 [0, 360)으로 정규화해서 한다.
 * - 놓으면 그 자리에 멈춘다. 관성과 복귀는 없다(임시, open-decisions G3 "닫힌 책 회전 범위와 감각").
 */
export type Rotation = {
  readonly yaw: number;
  readonly pitch: number;
};

/** 첫 화면 포즈. 임시, open-decisions G0 "닫힌 책 형태"(mockups/still closed-a의 rotateX(-8deg) rotateY(-11deg)). */
export const INITIAL_ROTATION: Rotation = { yaw: -11, pitch: -8 };

/** pitch 범위(±deg). 임시, open-decisions G3 "닫힌 책 회전 범위와 감각". yaw는 자유 회전. */
export const PITCH_LIMIT_DEG = 24;

/** 끌기 1 CSS px당 회전 각도. 임시, open-decisions G3 "닫힌 책 회전 범위와 감각". */
export const DEGREES_PER_DRAG_PX = 0.4;

/**
 * 키보드 ←/→ 한 번에 도는 각도. 임시, tech-research.md 7장 U1(드래그 없는 대안 미정)·G3 회전 범위.
 * 앞면·책등·뒷면·책배에 정확히 서도록 90° 단위로 맞춘다.
 */
const KEY_ROTATION_STEP_DEG = 90;

export type CoverFace = 'front' | 'spine' | 'back' | 'fore';

/**
 * 면이 보는 사람에게서 돌아섰다고 볼 경계(면 법선과 시선의 cos). 이보다 더 돌아선 큰 면(앞·뒤표지, 첫 쪽)은 숨긴다.
 * 3D 합성 없이 면을 평면으로 겹쳐 그리는 환경(Playwright 헤드리스 WebKit에서 관찰)에서도 DOM 순서상 마지막인 뒤표지가
 * 뒤집힌 채 앞에 그려지지 않게 하는 보조 장치다. 모서리에 가까운 각도는 원근 때문에 보일 수 있어 backface-visibility에 맡긴다.
 */
const TURNED_AWAY_COSINE = -0.2;

/** 정면(+z)을 보던 면이 yaw(deg)만큼 돌았을 때 보는 사람에게서 확실히 돌아섰는가. */
export function isFaceTurnedAway(faceYaw: number): boolean {
  return Math.cos((faceYaw * Math.PI) / 180) < TURNED_AWAY_COSINE;
}

export function clampPitch(pitch: number): number {
  return Math.min(Math.max(pitch, -PITCH_LIMIT_DEG), PITCH_LIMIT_DEG);
}

/** 누른 점에서 끈 거리만큼 시작 회전에 더한다. 화면 좌표(CSS px). */
export function rotateByDrag(start: Rotation, origin: Vec2, point: Vec2): Rotation {
  return {
    yaw: start.yaw + (point.x - origin.x) * DEGREES_PER_DRAG_PX,
    pitch: clampPitch(start.pitch - (point.y - origin.y) * DEGREES_PER_DRAG_PX),
  };
}

/** 가장 가까운 90° 면에 맞춘 뒤 한 단계 돈다. step 1은 오른쪽(→), -1은 왼쪽(←). */
export function rotateByKeyStep(rotation: Rotation, step: 1 | -1): Rotation {
  const snapped = Math.round(rotation.yaw / KEY_ROTATION_STEP_DEG) * KEY_ROTATION_STEP_DEG;
  return { yaw: snapped + step * KEY_ROTATION_STEP_DEG, pitch: rotation.pitch };
}

/** [0, 360)으로 정규화. */
export function normalizeDegrees(degrees: number): number {
  const remainder = degrees % 360;
  const positive = remainder < 0 ? remainder + 360 : remainder;
  // -0과 360 근처 반올림을 0으로 모은다.
  return positive === 360 || Object.is(positive, -0) ? 0 : positive;
}

/** 보는 사람 쪽을 향한 면. 경계 45°는 시계 방향 다음 면으로 센다. */
export function visibleFace(rotation: Rotation): CoverFace {
  const yaw = normalizeDegrees(rotation.yaw);
  if (yaw < 45 || yaw >= 315) {
    return 'front';
  }
  if (yaw < 135) {
    return 'spine';
  }
  if (yaw < 225) {
    return 'back';
  }
  return 'fore';
}

/** 앞면이 정면을 보는 가장 가까운 회전(펼치기 직전 포즈). */
export function frontRotation(rotation: Rotation): Rotation {
  // + 0은 -0을 0으로 바꾼다.
  return { yaw: Math.round(rotation.yaw / 360) * 360 + 0, pitch: 0 };
}

export function angularDistance(from: Rotation, to: Rotation): number {
  const yaw = to.yaw - from.yaw;
  const pitch = to.pitch - from.pitch;
  return Math.sqrt(yaw * yaw + pitch * pitch);
}

export function interpolateRotation(from: Rotation, to: Rotation, t: number): Rotation {
  return {
    yaw: from.yaw + (to.yaw - from.yaw) * t,
    pitch: from.pitch + (to.pitch - from.pitch) * t,
  };
}

/**
 * 닫힌 책 위 포인터 판별. 드래그는 회전, 클릭은 펼침이다(plan.md 흐름).
 * 시작 거리는 fold 모델 input-priority의 hasReachedDragStart와 후보값 8 CSS px를 그대로 쓴다.
 * 펼침 자체는 버튼의 click 이벤트가 맡고, 이 판별은 그 click을 막을지(suppressClick)만 알려 준다.
 */
export type RotateGesture =
  | { readonly phase: 'idle' }
  | {
      readonly phase: 'pressed' | 'dragging';
      readonly pointerId: number;
      readonly origin: Vec2;
      readonly start: Rotation;
    };

export type RotateGestureEvent =
  | { readonly type: 'down'; readonly pointerId: number; readonly point: Vec2 }
  | { readonly type: 'move'; readonly pointerId: number; readonly point: Vec2 }
  | { readonly type: 'up'; readonly pointerId: number; readonly point: Vec2 }
  | { readonly type: 'cancel'; readonly pointerId: number };

export type RotateGestureStep = {
  readonly gesture: RotateGesture;
  /** 새로 적용할 회전. 바뀌지 않으면 null. */
  readonly rotation: Rotation | null;
  /** 뒤따르는 click을 펼침으로 보지 않을지. 바꾸지 않으면 null. */
  readonly suppressClick: boolean | null;
};

export const IDLE_ROTATE_GESTURE: RotateGesture = { phase: 'idle' };

export function reduceRotateGesture(
  gesture: RotateGesture,
  event: RotateGestureEvent,
  current: Rotation,
  dragStartDistancePx: number = DEFAULT_DRAG_START_DISTANCE_PX
): RotateGestureStep {
  const unchanged: RotateGestureStep = { gesture, rotation: null, suppressClick: null };
  if (gesture.phase === 'idle') {
    if (event.type !== 'down') {
      return unchanged;
    }
    return {
      gesture: { phase: 'pressed', pointerId: event.pointerId, origin: event.point, start: current },
      rotation: null,
      suppressClick: false,
    };
  }
  if (event.type === 'down' || event.pointerId !== gesture.pointerId) {
    return unchanged;
  }
  if (event.type === 'cancel') {
    return { gesture: IDLE_ROTATE_GESTURE, rotation: null, suppressClick: true };
  }
  const reached = hasReachedDragStart(gesture.origin, event.point, dragStartDistancePx);
  if (event.type === 'up') {
    const dragged = gesture.phase === 'dragging';
    return {
      gesture: IDLE_ROTATE_GESTURE,
      rotation: dragged ? rotateByDrag(gesture.start, gesture.origin, event.point) : null,
      // 끌었거나, move 없이 멀리서 뗐으면 클릭이 아니다(input-priority.ts와 같은 규칙).
      suppressClick: dragged || reached,
    };
  }
  if (gesture.phase === 'pressed' && !reached) {
    return unchanged;
  }
  return {
    gesture: { ...gesture, phase: 'dragging' },
    rotation: rotateByDrag(gesture.start, gesture.origin, event.point),
    suppressClick: null,
  };
}
