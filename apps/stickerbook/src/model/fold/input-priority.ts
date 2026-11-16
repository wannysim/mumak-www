import type { TurnDirection } from './book-frame';
import type { Vec2 } from './vector';
import { lengthSquaredVec, subtractVec } from './vector';

/**
 * 같은 면에서 겹치는 입력의 우선순위와 클릭·드래그 판별(spikes.md S2-8, tech-research.md 7장 공통 규칙).
 *
 * - 누르는 순간 판정 영역으로 입력의 주인을 정한다. 링크·스티커·레코드 영역이 넘김 영역보다 우선한다.
 *   그 영역 위에서 시작한 입력은 클릭이든 드래그든 넘김이 되지 않는다.
 * - 링크·스티커·레코드 영역끼리 겹치면 앞(위에 그려진 것)부터 넘긴 배열 순서에서 처음 맞는 것이 주인이다.
 * - 누른 점에서 dragStartDistancePx 이상 움직이면 드래그, 그 전에 떼면 클릭이다(경계값과 같으면 드래그).
 *   드래그 시작은 move 이벤트에서만 한다. 드래그가 시작되지 않은 채 누른 점에서 시작 거리 이상 떨어진 곳에서
 *   up이 오면(move가 오지 않았거나 시작 거리 안쪽 move만 왔다) 클릭으로 보지 않고 취소처럼 효과 없이 끝낸다.
 *   링크를 누른 채 멀리 끌어 떼는 것은 클릭을 취소하는 관례이고, 넘김 영역에서는 떼는 방향을 알 수 없어서다.
 * - 처음 누른 포인터 하나만 따른다. 그동안 들어온 다른 포인터(두 번째 손가락)는 무시한다.
 * - 좌표계는 호출부가 정한다. 판정 영역과 포인터가 같은 좌표계(보통 화면 CSS px)면 된다.
 * - 판정 사각형은 경계를 포함한다.
 */
export type Rect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

type InteractiveKind = 'link' | 'sticker' | 'record';

type InteractiveRegion = {
  readonly id: string;
  readonly kind: InteractiveKind;
  readonly rect: Rect;
};

type TurnRegion = {
  readonly direction: TurnDirection;
  readonly rect: Rect;
};

export type InputSurface = {
  /** 앞(위에 그려진 것)부터 뒤 순서. */
  readonly interactiveRegions: readonly InteractiveRegion[];
  /**
   * 넘김 영역의 배치와 크기는 사용자 G2 결정이라 호출부가 넣는다.
   * 바깥 가장자리에서 멀리 뻗을수록 드래그 시작 프레임에 한 번에 접히는 띠가 넓어진다(turn-pose.ts projectToOuterEdge).
   */
  readonly turnRegions: readonly TurnRegion[];
};

export type InputOwner =
  | { readonly type: 'interactive'; readonly region: InteractiveRegion }
  | { readonly type: 'turn'; readonly direction: TurnDirection };

/**
 * 드래그 시작 거리(CSS px). 후보값, G2 사용자 결정(spikes.md S2-8 "시작 거리는 사용자 G2").
 * 근거: AOSP `ViewConfiguration` 기본 touch slop 8dp(기기마다 재정의됨).
 */
export const DEFAULT_DRAG_START_DISTANCE_PX = 8;

export type GestureState =
  | { readonly phase: 'idle' }
  | {
      readonly phase: 'pressed' | 'dragging';
      readonly pointerId: number;
      readonly owner: InputOwner;
      readonly origin: Vec2;
    };

export type GestureEvent =
  | { readonly type: 'down'; readonly pointerId: number; readonly point: Vec2 }
  | { readonly type: 'move'; readonly pointerId: number; readonly point: Vec2 }
  | { readonly type: 'up'; readonly pointerId: number; readonly point: Vec2 }
  | { readonly type: 'cancel'; readonly pointerId: number };

type GestureEffect =
  | { readonly type: 'none' }
  | { readonly type: 'click'; readonly owner: InputOwner; readonly point: Vec2 }
  | { readonly type: 'drag-start'; readonly owner: InputOwner; readonly origin: Vec2; readonly point: Vec2 }
  | { readonly type: 'drag-move'; readonly owner: InputOwner; readonly point: Vec2 }
  | { readonly type: 'drag-end'; readonly owner: InputOwner; readonly point: Vec2 }
  | { readonly type: 'drag-cancel'; readonly owner: InputOwner };

export type GestureContext = {
  readonly surface: InputSurface;
  readonly dragStartDistancePx: number;
};

export type GestureStep = {
  readonly state: GestureState;
  readonly effect: GestureEffect;
};

export const IDLE_GESTURE: GestureState = { phase: 'idle' };

const NO_EFFECT: GestureEffect = { type: 'none' };

export function isPointInRect(point: Vec2, rect: Rect): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

/** 누른 점의 입력 주인. 어느 영역에도 없으면 null. */
export function resolveInputOwner(point: Vec2, surface: InputSurface): InputOwner | null {
  const interactive = surface.interactiveRegions.find(region => isPointInRect(point, region.rect));
  if (interactive !== undefined) {
    return { type: 'interactive', region: interactive };
  }
  const turn = surface.turnRegions.find(region => isPointInRect(point, region.rect));
  if (turn !== undefined) {
    return { type: 'turn', direction: turn.direction };
  }
  return null;
}

export function hasReachedDragStart(origin: Vec2, point: Vec2, dragStartDistancePx: number): boolean {
  return lengthSquaredVec(subtractVec(point, origin)) >= dragStartDistancePx * dragStartDistancePx;
}

/** 포인터 이벤트 하나를 받아 다음 상태와 효과를 돌려준다. 같은 이벤트 순서면 같은 결과다. */
export function reduceGesture(state: GestureState, event: GestureEvent, context: GestureContext): GestureStep {
  if (state.phase === 'idle') {
    if (event.type !== 'down') {
      return { state, effect: NO_EFFECT };
    }
    const owner = resolveInputOwner(event.point, context.surface);
    if (owner === null) {
      return { state, effect: NO_EFFECT };
    }
    return { state: { phase: 'pressed', pointerId: event.pointerId, owner, origin: event.point }, effect: NO_EFFECT };
  }

  if (event.type === 'down' || event.pointerId !== state.pointerId) {
    return { state, effect: NO_EFFECT };
  }

  if (event.type === 'cancel') {
    const effect: GestureEffect = state.phase === 'dragging' ? { type: 'drag-cancel', owner: state.owner } : NO_EFFECT;
    return { state: IDLE_GESTURE, effect };
  }

  if (event.type === 'up') {
    return { state: IDLE_GESTURE, effect: releaseEffect(state, event.point, context.dragStartDistancePx) };
  }

  if (state.phase === 'dragging') {
    return { state, effect: { type: 'drag-move', owner: state.owner, point: event.point } };
  }
  if (!hasReachedDragStart(state.origin, event.point, context.dragStartDistancePx)) {
    return { state, effect: NO_EFFECT };
  }
  return {
    state: { ...state, phase: 'dragging' },
    effect: { type: 'drag-start', owner: state.owner, origin: state.origin, point: event.point },
  };
}

function releaseEffect(
  state: Exclude<GestureState, { readonly phase: 'idle' }>,
  point: Vec2,
  dragStartDistancePx: number
): GestureEffect {
  if (state.phase === 'dragging') {
    return { type: 'drag-end', owner: state.owner, point };
  }
  if (hasReachedDragStart(state.origin, point, dragStartDistancePx)) {
    return NO_EFFECT;
  }
  return { type: 'click', owner: state.owner, point };
}
