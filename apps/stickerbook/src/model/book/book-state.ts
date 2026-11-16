import type { BookView, PageLayout, TurnDirection, Vec2, ViewMove } from '@/model/fold';
import { nextView, previousView, spreadPages, viewOfPage, visiblePages } from '@/model/fold';

import type { OpenGeometry } from './geometry';
import { isSamePageSize, turnFrame } from './geometry';
import type { OpeningTimeline } from './opening';
import { createOpeningTimeline, isOpeningDone } from './opening';
import type { Rotation } from './rotation';
import { INITIAL_ROTATION, rotateByKeyStep } from './rotation';
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
 *
 * - 동작 줄이기(reducedMotion)면 펼침은 투명도 교차만 하고, 클릭 넘김과 놓은 뒤 착지는 같은 판정으로 바로 바꾼다
 *   (tech-research.md 7장). 드래그 넘김은 동작 줄이기에서도 같은 세션으로 진행도와 놓기 판정을 계산한다(그리는 방식만 다르다).
 *   움직이는 도중 동작 줄이기로 바뀌면 다음 프레임에 바로 착지한다(같은 놓기 판정 결과).
 * - 쪽 번호와 상태 알림(landing)은 착지할 때만 바뀐다. 넘기다 놓아 되돌아가면 알리지 않는다.
 * - 화면 배치(layout)가 바뀌면 지금 보이는 첫 쪽을 기준으로 새 배치의 화면으로 옮기고, 넘기던 장은 버린다.
 *   같은 배치에서 쪽 크기가 바뀌어도 넘기던 장은 버린다(잡은 점과 접힘선이 옛 쪽 크기 기준이라). 둘 다 알리지 않는다.
 *   화면 크기가 바뀌면 호출부가 'resize'를 보내 상태에 확정한다(렌더에서만 맞추면 원래 크기로 돌아올 때 버린 장이 되살아난다).
 * - 자동 착지 중에 넘김 입력(클릭·키·드래그 시작)이 오면 지금 장을 바로 착지시키고 새 넘김을 시작한다.
 *   누를 때마다 한 장씩 넘어간다. 임시, open-decisions G3 "넘김 감각 수치". 끄는 동안의 클릭·키 입력은 무시한다.
 */
export type BookScene =
  | { readonly phase: 'closed'; readonly rotation: Rotation; readonly rotationAnimated: boolean }
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
    };

type Landing = {
  /** 착지마다 1씩 는다. 같은 쪽으로 다시 착지해도 알림을 새로 쓰게 한다. */
  readonly serial: number;
  readonly pages: readonly number[];
};

export type BookState = {
  readonly pageCount: number;
  readonly scene: BookScene;
  readonly landing: Landing | null;
};

export type BookEvent =
  | { readonly type: 'rotate'; readonly rotation: Rotation }
  | { readonly type: 'rotate-step'; readonly step: 1 | -1 }
  | { readonly type: 'open'; readonly reducedMotion: boolean }
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

type TurningScene = Extract<BookScene, { phase: 'turning' }>;

/**
 * 세로 휴대폰에서 펼친 직후 보이는 쪽. 표지가 열리며 드러나는 쪽(2쪽)이다. 1쪽(앞표지 안쪽)은 이전 쪽으로 간다.
 * 임시, open-decisions G0 "쪽 지도"·"세로 휴대폰 배치".
 */
export const SINGLE_LAYOUT_FIRST_PAGE = 2;

export function createInitialBookState(pageCount: number): BookState {
  return {
    pageCount,
    scene: { phase: 'closed', rotation: INITIAL_ROTATION, rotationAnimated: false },
    landing: null,
  };
}

export function initialView(layout: PageLayout): BookView {
  return layout === 'spread' ? { layout, spread: 0 } : { layout, page: SINGLE_LAYOUT_FIRST_PAGE };
}

export function firstVisiblePage(view: BookView): number {
  return view.layout === 'spread' ? spreadPages(view.spread).left : view.page;
}

/**
 * 지금 화면 배치·쪽 크기에 맞춘 장면. 배치가 바뀌었으면 지금 보이는 첫 쪽이 든 새 배치의 화면으로 옮기고,
 * 쪽 크기만 바뀌었으면 넘기던 장을 버리고 넘기기 전 화면으로 둔다.
 */
export function sceneForGeometry(scene: BookScene, geometry: OpenGeometry): BookScene {
  if (scene.phase !== 'open' && scene.phase !== 'turning') {
    return scene;
  }
  if (scene.view.layout !== geometry.layout) {
    return { phase: 'open', view: viewOfPage(firstVisiblePage(scene.view), geometry.layout) };
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
  return scene.phase === 'opening' || (scene.phase === 'turning' && scene.session.motion.type === 'settle');
}

/** 러닝 헤드 쪽 번호에 쓸 쪽. 닫힌 책·펼치는 중이면 null. 넘기는 중에는 넘기기 전 쪽이다(착지 때 갱신). */
export function folioPages(scene: BookScene): number[] | null {
  return scene.phase === 'open' || scene.phase === 'turning' ? visiblePages(scene.view) : null;
}

/**
 * 새 넘김의 출발 화면. 쉬는 중이면 지금 화면, 자동 착지 중이면 그 착지가 끝날 화면이다.
 * 끄는 중이거나 펼친 책이 아니면 null(넘김 입력을 받지 않는다).
 */
export function turnBaseView(scene: BookScene): BookView | null {
  if (scene.phase === 'open') {
    return scene.view;
  }
  if (scene.phase !== 'turning' || scene.session.motion.type !== 'settle') {
    return null;
  }
  return settleOutcome(scene.session) === 'complete' ? scene.move.view : scene.view;
}

export function turnMove(view: BookView, direction: TurnDirection, pageCount: number): ViewMove | null {
  return direction === 'forward' ? nextView(view, pageCount) : previousView(view, pageCount);
}

function withScene(state: BookState, scene: BookScene): BookState {
  return scene === state.scene ? state : { ...state, scene };
}

function land(state: BookState, view: BookView): BookState {
  const serial = state.landing === null ? 1 : state.landing.serial + 1;
  return { ...state, scene: { phase: 'open', view }, landing: { serial, pages: visiblePages(view) } };
}

function finishTurn(state: BookState, scene: TurningScene, session: TurnSession): BookState {
  return settleOutcome(session) === 'complete'
    ? land(state, scene.move.view)
    : withScene(state, { phase: 'open', view: scene.view });
}

/** 자동 착지 중인 장을 그 결과대로 바로 착지시킨다. */
function settleNow(state: BookState): BookState {
  const { scene } = state;
  return scene.phase === 'turning' && scene.session.motion.type === 'settle'
    ? finishTurn(state, scene, scene.session)
    : state;
}

function setupFor(geometry: OpenGeometry, direction: TurnDirection): TurnSetup {
  return { frame: turnFrame(geometry, direction), direction, page: geometry.page };
}

function startTurn(
  state: BookState,
  geometry: OpenGeometry,
  direction: TurnDirection,
  begin: (setup: TurnSetup) => TurnSession,
  reducedMotionClick: boolean
): BookState {
  const current = withScene(state, sceneForGeometry(state.scene, geometry));
  const base = turnBaseView(current.scene);
  const move = base === null ? null : turnMove(base, direction, state.pageCount);
  if (base === null || move === null) {
    return current;
  }
  const settled = settleNow(current);
  if (reducedMotionClick) {
    return land(settled, move.view);
  }
  return withScene(settled, { phase: 'turning', view: base, move, session: begin(setupFor(geometry, direction)) });
}

function onFrame(state: BookState, time: number, geometry: OpenGeometry, reducedMotion: boolean): BookState {
  const scene = sceneForGeometry(state.scene, geometry);
  if (scene.phase === 'opening') {
    const startTime = scene.startTime ?? time;
    const elapsedMs = Math.max(time - startTime, 0);
    const skipMotion = reducedMotion && !scene.timeline.crossfade;
    if (skipMotion || isOpeningDone(scene.timeline, elapsedMs)) {
      return land(state, initialView(geometry.layout));
    }
    return withScene(state, { ...scene, startTime, elapsedMs });
  }
  if (scene.phase !== 'turning') {
    return withScene(state, scene);
  }
  if (reducedMotion && scene.session.motion.type === 'settle') {
    return finishTurn(state, scene, scene.session);
  }
  const session = advanceTurn(scene.session, time);
  if (isTurnSettled(session)) {
    return finishTurn(state, scene, session);
  }
  return session === scene.session ? state : withScene(state, { ...scene, session });
}

function updateDrag(state: BookState, geometry: OpenGeometry, update: (scene: TurningScene) => BookState): BookState {
  const scene = sceneForGeometry(state.scene, geometry);
  if (scene.phase !== 'turning' || scene.session.motion.type !== 'drag') {
    return withScene(state, scene);
  }
  return update(scene);
}

function settleDrag(state: BookState, scene: TurningScene, session: TurnSession, reducedMotion: boolean): BookState {
  return reducedMotion ? finishTurn(state, scene, session) : withScene(state, { ...scene, session });
}

export function reduceBook(state: BookState, event: BookEvent): BookState {
  const { scene } = state;
  switch (event.type) {
    case 'rotate':
      return scene.phase === 'closed'
        ? withScene(state, { phase: 'closed', rotation: event.rotation, rotationAnimated: false })
        : state;
    case 'rotate-step':
      return scene.phase === 'closed'
        ? withScene(state, {
            phase: 'closed',
            rotation: rotateByKeyStep(scene.rotation, event.step),
            rotationAnimated: true,
          })
        : state;
    case 'open':
      return scene.phase === 'closed'
        ? withScene(state, {
            phase: 'opening',
            timeline: createOpeningTimeline(scene.rotation, event.reducedMotion),
            startTime: null,
            elapsedMs: 0,
          })
        : state;
    case 'resize':
      return withScene(state, sceneForGeometry(scene, event.geometry));
    case 'frame':
      return onFrame(state, event.time, event.geometry, event.reducedMotion);
    case 'turn-click':
      return startTurn(
        state,
        event.geometry,
        event.direction,
        setup => beginClickTurn(setup, event.press),
        event.reducedMotion
      );
    case 'turn-drag-start':
      return startTurn(
        state,
        event.geometry,
        event.direction,
        setup => beginDragTurn(setup, event.origin, event.point, event.time),
        false
      );
    case 'turn-drag-move':
      return updateDrag(state, event.geometry, turning =>
        withScene(state, { ...turning, session: continueDragTurn(turning.session, event.point, event.time) })
      );
    case 'turn-drag-end':
      return updateDrag(state, event.geometry, turning =>
        settleDrag(state, turning, releaseDragTurn(turning.session, event.point, event.time), event.reducedMotion)
      );
    case 'turn-drag-cancel':
      return updateDrag(state, event.geometry, turning =>
        settleDrag(state, turning, cancelDragTurn(turning.session), event.reducedMotion)
      );
  }
}
