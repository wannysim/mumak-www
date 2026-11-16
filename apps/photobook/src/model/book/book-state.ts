import type { BookView, PageLayout, PageSize, TurnDirection, Vec2, ViewMove } from '@/model/fold';
import { nextView, previousView, spreadPages, viewOfPage, visiblePages } from '@/model/fold';

import type { ClosingTimeline, CoverDrag, CoverReturn } from './closing';
import {
  advanceCoverReturn,
  beginCoverDrag,
  continueCoverDrag,
  coverDragProgress,
  coverLens,
  coverReturnProgress,
  coverSideFor,
  createClosingTimeline,
  isClosingDone,
  isCoverReturnDone,
  releaseCoverDrag,
  startCoverReturn,
} from './closing';
import type { OpenGeometry } from './geometry';
import { isSamePageSize, turnFrame } from './geometry';
import type { KeySpin } from './key-spin';
import { advanceKeySpin, keySpinOrientation, keySpinTarget, keySpinVelocity, startKeySpin } from './key-spin';
import type { OpeningTimeline } from './opening';
import { createOpeningTimeline, isOpeningDone } from './opening';
import type { CoverSide, Orientation } from './rotation';
import { INITIAL_ORIENTATION, restOrientation, rotateByDrag } from './rotation';
import type { Spin } from './spin';
import { advanceSpin, isSpinDone, spinFromVelocity, spinOrientation, spinVelocity, startSpin } from './spin';
import type { TurnSession, TurnSetup } from './turn-session';
import {
  advanceTurn,
  beginClickTurn,
  beginDragTurn,
  cancelDragTurn,
  continueDragTurn,
  isTurnSettled,
  releaseDragTurn,
  settleOutcome,
} from './turn-session';

/**
 * 책 전체의 상태 기계. 순수 함수이고 시간은 이벤트로 받는다(플랫폼 API 없음).
 *
 * closed ─open→ opening ─frame…→ open(view) ─turn-*→ turning ─frame…→ open(view)
 * open ─close·끝에서 넘김→ closing(side) ─frame…→ closed(쉬는 자세)        (2026-11-16 사용자 결정 A)
 *
 * 닫힌 책(closed)
 * - 자세는 쿼터니언(rotation.ts)이고 motion이 움직임이다: rest, spin(놓은 뒤 관성), key(화살표를 누르는 동안 회전).
 *   끌기(spin-drag)는 화면 기준 축에 변화량을 더한다. 누르면(spin-grab) 돌던 책이 그 자리에 선다.
 *   누른 화살표 조합이 바뀌면(key-spin) 지금 자세·빠르기에서 이어 돌고, 다 떼면 그 빠르기로 관성에 넘긴다(key-spin.ts).
 * - 동작 줄이기면 관성 없이 놓은 자리에 서고, 화살표는 누르는 동안만 가속 없이 돈다. 관성으로 도는 중에 동작 줄이기로
 *   바뀌면 다음 프레임에 선다.
 * - 덮고 나면 닫힌 책은 덮은 표지의 쉬는 자세(rotation.ts restOrientation)를 기억한다. 뒤표지로 덮으면 뒷면이 보인다.
 *
 * 펼침·넘김
 * - 동작 줄이기(reducedMotion)면 펼침은 투명도 교차만 하고, 클릭 넘김과 놓은 뒤 착지는 같은 판정으로 바로 바꾼다
 *   (tech-research.md 7장). 드래그 넘김은 동작 줄이기에서도 같은 세션으로 진행도와 놓기 판정을 계산한다(그리는 방식만 다르다).
 *   움직이는 도중 동작 줄이기로 바뀌면 다음 프레임에 바로 착지한다(같은 놓기 판정 결과).
 * - 쪽 번호와 상태 알림(announcement)은 착지할 때만 바뀐다. 넘기다 놓아 되돌아가면 알리지 않는다.
 * - 화면 배치(layout)가 바뀌면 지금 보이는 첫 쪽을 기준으로 새 배치의 화면으로 옮기고, 넘기던 장은 버린다.
 *   같은 배치에서 쪽 크기가 바뀌어도 넘기던 장은 버린다(잡은 점과 접힘선이 옛 쪽 크기 기준이라). 둘 다 알리지 않는다.
 *   화면 크기가 바뀌면 호출부가 'resize'를 보내 상태에 확정한다(렌더에서만 맞추면 원래 크기로 돌아올 때 버린 장이 되살아난다).
 * - 자동 착지 중에 넘김 입력(클릭·키·드래그 시작)이 오면 지금 장을 바로 착지시키고 새 넘김을 시작한다.
 *   누를 때마다 한 장씩 넘어간다. 임시, open-decisions G3 "넘김 감각 수치". 끄는 동안의 클릭·키 입력은 무시한다.
 *
 * 덮기(closing). 세 가지 입력이 같은 덮기가 된다:
 * - 끝에서 넘김: 첫 펼침(세로 폰은 첫 쪽)에서 뒤로, 마지막 펼침(세로 폰은 마지막 쪽)에서 앞으로 넘기는 입력(드래그·버튼·←/→)은
 *   넘길 장이 없으므로 그 끝의 표지(앞표지·뒤표지)로 덮는다. 넘김 세션과 덮기 세션은 같은 입력 경로·같은 놓기 판정을 쓰고,
 *   한 번에 하나만 있다(scene이 turning이거나 closing).
 * - 'close' 이벤트(Esc, 러닝 헤드 이름): 어느 쪽에서든 앞표지로 덮는다. 가운데 펼침이면 왼쪽 장들이 표지와 함께 덮인다(geometry.ts coverLayout).
 * - closing.stage: drag(손으로 끄는 중) → 놓으면 transition(완주) 또는 return(복귀 → open). 버튼·키·Esc·이름은 바로 transition.
 *   transition이 끝나면 closed에 착지하고 덮은 표지를 한 번 알린다(announcement kind 'closed').
 *
 * 입력 경쟁(임시, open-decisions G3 "넘김 감각 수치"와 같은 원칙):
 * - 덮는 중(transition) 입력: 넘김·덮기·회전·펼침 입력을 모두 무시한다. 펼침과 같다(펼치는 중에도 넘김 입력을 무시한다).
 * - 손으로 덮는 중(drag): 다른 입력을 무시한다(끄는 넘김과 같다). Esc도 무시한다.
 * - 놓아서 되돌아가는 중(return): 자동 착지처럼 다룬다. 넘김 입력은 되돌림을 바로 끝내(open) 새 넘김·덮기를 시작한다.
 *   같은 표지로 덮는 입력(Esc·이름·버튼)은 되돌아가던 각도에서 그대로 다시 덮는다(넘겨주기 없음).
 * - 펼치는 중 Esc: 무시한다. 아직 펼친 책이 아니다. 펼친 뒤 다시 누르면 덮는다.
 * - 넘기는 중 Esc: 자동 착지 중이면 그 장을 바로 착지시키고 착지한 화면에서 덮는다. 손으로 끄는 중이면 무시한다.
 * - 배치 변경 중 덮기: 손으로 덮는 중·되돌아가는 중(표지 각도가 쪽 크기 기준)이면 넘기던 장처럼 버리고 새 배치의 펼친 책으로 둔다.
 *   덮기 전환(transition)은 그대로 이어 닫는다. 3D 책 자리는 그리는 순간의 배치로 다시 계산하고, 기억한 화면(view)만 새 배치로 옮긴다.
 */
export type ClosedMotion =
  | { readonly type: 'rest' }
  | { readonly type: 'spin'; readonly spin: Spin }
  | { readonly type: 'key'; readonly spin: KeySpin };

type ClosingStage =
  | { readonly type: 'drag'; readonly drag: CoverDrag }
  | { readonly type: 'return'; readonly cover: CoverReturn }
  | {
      readonly type: 'transition';
      readonly timeline: ClosingTimeline;
      readonly startTime: number | null;
      readonly elapsedMs: number;
    };

export type BookScene =
  | { readonly phase: 'closed'; readonly orientation: Orientation; readonly motion: ClosedMotion }
  | {
      readonly phase: 'opening';
      readonly timeline: OpeningTimeline;
      readonly startTime: number | null;
      readonly elapsedMs: number;
    }
  | { readonly phase: 'open'; readonly view: BookView }
  | {
      readonly phase: 'turning';
      readonly view: BookView;
      readonly move: ViewMove;
      readonly session: TurnSession;
    }
  | {
      readonly phase: 'closing';
      readonly side: CoverSide;
      /** 덮기 전 화면. 되돌아가면 여기로 돌아오고, 3D 책이 보여 줄 쪽(coverLayout)도 이 화면 기준이다. */
      readonly view: BookView;
      /** 덮기를 시작한 쪽 크기. 끄는 중에 바뀌면 덮기를 버린다. */
      readonly page: PageSize;
      readonly stage: ClosingStage;
    };

/** 상태 영역에 한 번 알릴 것. serial은 알릴 때마다 1씩 늘어 같은 문구도 새로 읽게 한다. */
export type Announcement =
  | { readonly serial: number; readonly kind: 'pages'; readonly pages: readonly number[] }
  | { readonly serial: number; readonly kind: 'closed'; readonly side: CoverSide };

export type BookState = {
  readonly pageCount: number;
  readonly scene: BookScene;
  readonly announcement: Announcement | null;
};

export type BookEvent =
  | { readonly type: 'spin-grab' }
  | { readonly type: 'spin-drag'; readonly delta: Vec2 }
  | { readonly type: 'spin-release'; readonly delta: Vec2; readonly velocity: Vec2; readonly reducedMotion: boolean }
  /** 누르고 있는 화살표 조합이 바뀌었다. direction은 그 방향 합(keyboard.ts arrowDirection), 다 뗐으면 0이다. */
  | { readonly type: 'key-spin'; readonly direction: Vec2; readonly reducedMotion: boolean }
  | { readonly type: 'open'; readonly reducedMotion: boolean }
  | {
      readonly type: 'close';
      readonly side: CoverSide;
      readonly geometry: OpenGeometry;
      readonly reducedMotion: boolean;
    }
  | { readonly type: 'resize'; readonly geometry: OpenGeometry }
  | {
      readonly type: 'frame';
      readonly time: number;
      readonly geometry: OpenGeometry;
      readonly reducedMotion: boolean;
    }
  | {
      readonly type: 'turn-click';
      readonly direction: TurnDirection;
      /** 누른 점(책 좌표). 키보드·보조 기술 활성화처럼 위치가 없으면 null. */
      readonly press: Vec2 | null;
      readonly geometry: OpenGeometry;
      readonly reducedMotion: boolean;
    }
  | {
      readonly type: 'turn-drag-start';
      readonly direction: TurnDirection;
      readonly origin: Vec2;
      readonly point: Vec2;
      readonly time: number;
      readonly geometry: OpenGeometry;
    }
  | { readonly type: 'turn-drag-move'; readonly point: Vec2; readonly time: number; readonly geometry: OpenGeometry }
  | {
      readonly type: 'turn-drag-end';
      readonly point: Vec2;
      readonly time: number;
      readonly geometry: OpenGeometry;
      readonly reducedMotion: boolean;
    }
  | { readonly type: 'turn-drag-cancel'; readonly geometry: OpenGeometry; readonly reducedMotion: boolean };

type ClosedScene = Extract<BookScene, { phase: 'closed' }>;
type TurningScene = Extract<BookScene, { phase: 'turning' }>;
type ClosingScene = Extract<BookScene, { phase: 'closing' }>;

/**
 * 세로 휴대폰에서 펼친 직후 보이는 쪽. 표지가 열리며 드러나는 쪽(2쪽)이다. 1쪽(앞표지 안쪽)은 이전 쪽으로 간다.
 * 임시, open-decisions G0 "쪽 지도"·"세로 휴대폰 배치".
 */
export const SINGLE_LAYOUT_FIRST_PAGE = 2;

const REST: ClosedMotion = { type: 'rest' };

export function createInitialBookState(pageCount: number): BookState {
  return {
    pageCount,
    scene: { phase: 'closed', orientation: INITIAL_ORIENTATION, motion: REST },
    announcement: null,
  };
}

export function initialView(layout: PageLayout): BookView {
  return layout === 'spread' ? { layout, spread: 0 } : { layout, page: SINGLE_LAYOUT_FIRST_PAGE };
}

export function firstVisiblePage(view: BookView): number {
  return view.layout === 'spread' ? spreadPages(view.spread).left : view.page;
}

function remapView(view: BookView, layout: PageLayout): BookView {
  return viewOfPage(firstVisiblePage(view), layout);
}

/**
 * 지금 화면 배치·쪽 크기에 맞춘 장면. 배치가 바뀌었으면 지금 보이는 첫 쪽이 든 새 배치의 화면으로 옮기고,
 * 쪽 크기만 바뀌었으면 넘기던 장을 버리고 넘기기 전 화면으로 둔다. 덮기는 위 "배치 변경 중 덮기" 규칙을 따른다.
 */
export function sceneForGeometry(scene: BookScene, geometry: OpenGeometry): BookScene {
  if (scene.phase === 'closing') {
    const layoutChanged = scene.view.layout !== geometry.layout;
    if (scene.stage.type === 'transition') {
      return layoutChanged ? { ...scene, view: remapView(scene.view, geometry.layout), page: geometry.page } : scene;
    }
    if (layoutChanged) {
      return { phase: 'open', view: remapView(scene.view, geometry.layout) };
    }
    return isSamePageSize(scene.page, geometry.page) ? scene : { phase: 'open', view: scene.view };
  }
  if (scene.phase !== 'open' && scene.phase !== 'turning') {
    return scene;
  }
  if (scene.view.layout !== geometry.layout) {
    return { phase: 'open', view: remapView(scene.view, geometry.layout) };
  }
  if (scene.phase === 'turning' && !isSamePageSize(scene.session.page, geometry.page)) {
    return { phase: 'open', view: scene.view };
  }
  return scene;
}

/** 화면 크기가 바뀌어 상태를 'resize'로 맞춰야 하는가. */
export function needsResync(scene: BookScene, geometry: OpenGeometry): boolean {
  return sceneForGeometry(scene, geometry) !== scene;
}

/** 자동으로 움직이는 중이라 프레임이 필요한가. 쉬는 동안과 손으로 끄는 동안은 false다. */
export function needsFrames(scene: BookScene): boolean {
  switch (scene.phase) {
    case 'closed':
      return scene.motion.type !== 'rest';
    case 'opening':
      return true;
    case 'turning':
      return scene.session.motion.type === 'settle';
    case 'closing':
      return scene.stage.type !== 'drag';
    case 'open':
      return false;
  }
}

/**
 * 러닝 헤드 쪽 번호에 쓸 쪽. 넘기는 중에는 넘기기 전 쪽이다(착지 때 갱신). 손으로 덮는 중·되돌아가는 중에도 덮기 전 쪽이다.
 * 닫힌 책·펼치는 중·덮기 전환 중이면 null(면 이름을 쓴다).
 */
export function folioPages(scene: BookScene): number[] | null {
  if (scene.phase === 'open' || scene.phase === 'turning') {
    return visiblePages(scene.view);
  }
  if (scene.phase === 'closing' && scene.stage.type !== 'transition') {
    return visiblePages(scene.view);
  }
  return null;
}

/**
 * 새 넘김·덮기의 출발 화면. 쉬는 중이면 지금 화면, 자동 착지 중이면 그 착지가 끝날 화면, 덮다 되돌아가는 중이면 덮기 전 화면이다.
 * 끄는 중이거나 펼친 책이 아니거나 덮는 중이면 null(넘김·덮기 입력을 받지 않는다).
 */
export function turnBaseView(scene: BookScene): BookView | null {
  switch (scene.phase) {
    case 'open':
      return scene.view;
    case 'turning':
      if (scene.session.motion.type !== 'settle') {
        return null;
      }
      return settleOutcome(scene.session) === 'complete' ? scene.move.view : scene.view;
    case 'closing':
      return scene.stage.type === 'return' ? scene.view : null;
    default:
      return null;
  }
}

/** 지금 'close' 입력(Esc·이름)이 무엇인가를 하는가. */
export function canClose(scene: BookScene): boolean {
  return turnBaseView(scene) !== null;
}

function turnMove(view: BookView, direction: TurnDirection, pageCount: number): ViewMove | null {
  return direction === 'forward' ? nextView(view, pageCount) : previousView(view, pageCount);
}

/** 그 방향으로 넘길 장이 없어 표지를 덮는 끝인가. 덮는 표지, 끝이 아니면 null. */
export function closingSideAt(view: BookView, direction: TurnDirection, pageCount: number): CoverSide | null {
  return turnMove(view, direction, pageCount) === null ? coverSideFor(direction) : null;
}

function withScene(state: BookState, scene: BookScene): BookState {
  return scene === state.scene ? state : { ...state, scene };
}

function nextSerial(state: BookState): number {
  return state.announcement === null ? 1 : state.announcement.serial + 1;
}

function land(state: BookState, view: BookView): BookState {
  return {
    ...state,
    scene: { phase: 'open', view },
    announcement: { serial: nextSerial(state), kind: 'pages', pages: visiblePages(view) },
  };
}

function landClosed(state: BookState, side: CoverSide): BookState {
  return {
    ...state,
    scene: { phase: 'closed', orientation: restOrientation(side), motion: REST },
    announcement: { serial: nextSerial(state), kind: 'closed', side },
  };
}

function finishTurn(state: BookState, scene: TurningScene, session: TurnSession): BookState {
  return settleOutcome(session) === 'complete'
    ? land(state, scene.move.view)
    : withScene(state, { phase: 'open', view: scene.view });
}

/** 자동 착지 중인 장, 되돌아가는 표지를 그 결과대로 바로 끝낸다. */
function settleNow(state: BookState): BookState {
  const { scene } = state;
  if (scene.phase === 'turning' && scene.session.motion.type === 'settle') {
    return finishTurn(state, scene, scene.session);
  }
  if (scene.phase === 'closing' && scene.stage.type === 'return') {
    return withScene(state, { phase: 'open', view: scene.view });
  }
  return state;
}

function setupFor(geometry: OpenGeometry, direction: TurnDirection): TurnSetup {
  return { frame: turnFrame(geometry, direction), direction, page: geometry.page };
}

function resynced(state: BookState, geometry: OpenGeometry): BookState {
  return withScene(state, sceneForGeometry(state.scene, geometry));
}

function transitionStage(timeline: ClosingTimeline): ClosingStage {
  return { type: 'transition', timeline, startTime: null, elapsedMs: 0 };
}

/** 버튼·키·Esc·이름으로 덮기. state는 화면 크기에 맞춘 뒤다. */
function startClose(state: BookState, side: CoverSide, geometry: OpenGeometry, reducedMotion: boolean): BookState {
  const { scene } = state;
  if (scene.phase === 'closing' && scene.stage.type === 'return' && scene.side === side) {
    const coverOpen = 1 - coverReturnProgress(scene.stage.cover);
    const timeline = createClosingTimeline(side, { coverOpen, fromDom: false, reducedMotion });
    return withScene(state, { ...scene, stage: transitionStage(timeline) });
  }
  const base = turnBaseView(scene);
  if (base === null) {
    return state;
  }
  const timeline = createClosingTimeline(side, { coverOpen: 1, fromDom: true, reducedMotion });
  return withScene(settleNow(state), {
    phase: 'closing',
    side,
    view: base,
    page: geometry.page,
    stage: transitionStage(timeline),
  });
}

function onTurnClick(state: BookState, event: Extract<BookEvent, { type: 'turn-click' }>): BookState {
  const current = resynced(state, event.geometry);
  const base = turnBaseView(current.scene);
  if (base === null) {
    return current;
  }
  const move = turnMove(base, event.direction, state.pageCount);
  if (move === null) {
    return startClose(current, coverSideFor(event.direction), event.geometry, event.reducedMotion);
  }
  const settled = settleNow(current);
  if (event.reducedMotion) {
    return land(settled, move.view);
  }
  const session = beginClickTurn(setupFor(event.geometry, event.direction), event.press);
  return withScene(settled, { phase: 'turning', view: base, move, session });
}

function onTurnDragStart(state: BookState, event: Extract<BookEvent, { type: 'turn-drag-start' }>): BookState {
  const { geometry, direction, origin, point, time } = event;
  const current = resynced(state, geometry);
  const base = turnBaseView(current.scene);
  if (base === null) {
    return current;
  }
  const move = turnMove(base, direction, state.pageCount);
  const settled = settleNow(current);
  const setup = setupFor(geometry, direction);
  if (move === null) {
    return withScene(settled, {
      phase: 'closing',
      side: coverSideFor(direction),
      view: base,
      page: geometry.page,
      stage: {
        type: 'drag',
        drag: beginCoverDrag({ ...setup, lens: coverLens(setup, geometry) }, origin, point, time),
      },
    });
  }
  return withScene(settled, { phase: 'turning', view: base, move, session: beginDragTurn(setup, origin, point, time) });
}

/** 놓은 뒤 덮인 정도 progress에서 완주(덮기 전환)하거나 복귀(다시 펼침)한다. */
function releaseCover(
  state: BookState,
  scene: ClosingScene,
  progress: number,
  complete: boolean,
  reducedMotion: boolean
): BookState {
  if (complete) {
    if (reducedMotion) {
      return landClosed(state, scene.side);
    }
    const timeline = createClosingTimeline(scene.side, { coverOpen: 1 - progress, fromDom: false, reducedMotion });
    return withScene(state, { ...scene, stage: transitionStage(timeline) });
  }
  if (reducedMotion) {
    return withScene(state, { phase: 'open', view: scene.view });
  }
  return withScene(state, { ...scene, stage: { type: 'return', cover: startCoverReturn(progress) } });
}

function updateDrag(
  state: BookState,
  geometry: OpenGeometry,
  onTurn: (scene: TurningScene) => BookState,
  onCover: (scene: ClosingScene, drag: CoverDrag) => BookState
): BookState {
  const scene = sceneForGeometry(state.scene, geometry);
  if (scene.phase === 'turning' && scene.session.motion.type === 'drag') {
    return onTurn(scene);
  }
  if (scene.phase === 'closing' && scene.stage.type === 'drag') {
    return onCover(scene, scene.stage.drag);
  }
  return withScene(state, scene);
}

function settleDrag(state: BookState, scene: TurningScene, session: TurnSession, reducedMotion: boolean): BookState {
  return reducedMotion ? finishTurn(state, scene, session) : withScene(state, { ...scene, session });
}

function closedFrame(scene: ClosedScene, time: number, reducedMotion: boolean): ClosedScene {
  const { motion } = scene;
  if (motion.type === 'spin') {
    if (reducedMotion) {
      return { ...scene, motion: REST };
    }
    const spin = advanceSpin(motion.spin, time);
    return {
      phase: 'closed',
      orientation: spinOrientation(spin),
      motion: isSpinDone(spin) ? REST : { type: 'spin', spin },
    };
  }
  if (motion.type === 'key') {
    const spin = advanceKeySpin(motion.spin, time);
    return { phase: 'closed', orientation: keySpinOrientation(spin), motion: { type: 'key', spin } };
  }
  return scene;
}

/** 닫힌 책이 지금 도는 빠르기(끄는 방향 벡터, deg/ms)와 지난 프레임 시각. 화살표 조합이 바뀔 때 이어 갈 값이다. */
function closedVelocity(motion: ClosedMotion): { readonly velocity: Vec2; readonly lastTime: number | null } {
  switch (motion.type) {
    case 'spin':
      return { velocity: spinVelocity(motion.spin), lastTime: motion.spin.lastTime };
    case 'key':
      return { velocity: keySpinVelocity(motion.spin), lastTime: motion.spin.lastTime };
    default:
      return { velocity: { x: 0, y: 0 }, lastTime: null };
  }
}

/** 누른 화살표가 바뀌었다. 누른 게 있으면 지금 자세·빠르기에서 그쪽으로 돌고, 다 뗐으면 관성으로 돌다 멈춘다. */
function changeKeySpin(closed: ClosedScene, direction: Vec2, reducedMotion: boolean): ClosedScene {
  const current = closedVelocity(closed.motion);
  const target = keySpinTarget(direction);
  if (target.x === 0 && target.y === 0) {
    const spin = reducedMotion ? null : spinFromVelocity(closed.orientation, current.velocity, current.lastTime);
    return { ...closed, motion: spin === null ? REST : { type: 'spin', spin } };
  }
  return { ...closed, motion: { type: 'key', spin: startKeySpin(closed.orientation, current, target, reducedMotion) } };
}

function closingFrame(state: BookState, scene: ClosingScene, time: number, reducedMotion: boolean): BookState {
  const { stage } = scene;
  if (stage.type === 'drag') {
    return withScene(state, scene);
  }
  if (stage.type === 'return') {
    const cover = advanceCoverReturn(stage.cover, time);
    if (reducedMotion || isCoverReturnDone(cover)) {
      return withScene(state, { phase: 'open', view: scene.view });
    }
    return withScene(state, { ...scene, stage: { type: 'return', cover } });
  }
  const startTime = stage.startTime ?? time;
  const elapsedMs = Math.max(time - startTime, 0);
  const skipMotion = reducedMotion && !stage.timeline.crossfade;
  if (skipMotion || isClosingDone(stage.timeline, elapsedMs)) {
    return landClosed(state, scene.side);
  }
  return withScene(state, { ...scene, stage: { ...stage, startTime, elapsedMs } });
}

function onFrame(state: BookState, time: number, geometry: OpenGeometry, reducedMotion: boolean): BookState {
  const scene = sceneForGeometry(state.scene, geometry);
  switch (scene.phase) {
    case 'closed':
      return withScene(state, closedFrame(scene, time, reducedMotion));
    case 'opening': {
      const startTime = scene.startTime ?? time;
      const elapsedMs = Math.max(time - startTime, 0);
      const skipMotion = reducedMotion && !scene.timeline.crossfade;
      if (skipMotion || isOpeningDone(scene.timeline, elapsedMs)) {
        return land(state, initialView(geometry.layout));
      }
      return withScene(state, { ...scene, startTime, elapsedMs });
    }
    case 'turning': {
      if (reducedMotion && scene.session.motion.type === 'settle') {
        return finishTurn(state, scene, scene.session);
      }
      const session = advanceTurn(scene.session, time);
      if (isTurnSettled(session)) {
        return finishTurn(state, scene, session);
      }
      return session === scene.session ? withScene(state, scene) : withScene(state, { ...scene, session });
    }
    case 'closing':
      return closingFrame(state, scene, time, reducedMotion);
    case 'open':
      return withScene(state, scene);
  }
}

function onClosed(state: BookState, update: (scene: ClosedScene) => ClosedScene): BookState {
  return state.scene.phase === 'closed' ? withScene(state, update(state.scene)) : state;
}

export function reduceBook(state: BookState, event: BookEvent): BookState {
  const { scene } = state;
  switch (event.type) {
    case 'spin-grab':
      return onClosed(state, closed => (closed.motion.type === 'rest' ? closed : { ...closed, motion: REST }));
    case 'spin-drag':
      return onClosed(state, closed => ({
        phase: 'closed',
        orientation: rotateByDrag(closed.orientation, event.delta),
        motion: REST,
      }));
    case 'spin-release':
      return onClosed(state, closed => {
        const orientation = rotateByDrag(closed.orientation, event.delta);
        const spin = event.reducedMotion ? null : startSpin(orientation, event.velocity);
        return { phase: 'closed', orientation, motion: spin === null ? REST : { type: 'spin', spin } };
      });
    case 'key-spin':
      return onClosed(state, closed => changeKeySpin(closed, event.direction, event.reducedMotion));
    case 'open':
      return scene.phase === 'closed'
        ? withScene(state, {
            phase: 'opening',
            timeline: createOpeningTimeline(scene.orientation, event.reducedMotion),
            startTime: null,
            elapsedMs: 0,
          })
        : state;
    case 'close':
      return startClose(resynced(state, event.geometry), event.side, event.geometry, event.reducedMotion);
    case 'resize':
      return resynced(state, event.geometry);
    case 'frame':
      return onFrame(state, event.time, event.geometry, event.reducedMotion);
    case 'turn-click':
      return onTurnClick(state, event);
    case 'turn-drag-start':
      return onTurnDragStart(state, event);
    case 'turn-drag-move':
      return updateDrag(
        state,
        event.geometry,
        turning =>
          withScene(state, { ...turning, session: continueDragTurn(turning.session, event.point, event.time) }),
        (closing, drag) =>
          withScene(state, {
            ...closing,
            stage: { type: 'drag', drag: continueCoverDrag(drag, event.point, event.time) },
          })
      );
    case 'turn-drag-end':
      return updateDrag(
        state,
        event.geometry,
        turning =>
          settleDrag(state, turning, releaseDragTurn(turning.session, event.point, event.time), event.reducedMotion),
        (closing, drag) => {
          const { progress, outcome } = releaseCoverDrag(drag, event.point, event.time);
          return releaseCover(state, closing, progress, outcome === 'complete', event.reducedMotion);
        }
      );
    case 'turn-drag-cancel':
      return updateDrag(
        state,
        event.geometry,
        turning => settleDrag(state, turning, cancelDragTurn(turning.session), event.reducedMotion),
        (closing, drag) => releaseCover(state, closing, coverDragProgress(drag), false, event.reducedMotion)
      );
  }
}
