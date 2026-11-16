import type { PointerSample, ReleaseConfig, ReleaseOutcome, TurnDirection, Vec2 } from '@/model/fold';
import {
  decideRelease,
  DEFAULT_RELEASE_CONFIG,
  estimateVelocity,
  retainSamplesForWindow,
  toModelPoint,
} from '@/model/fold';

import { OPEN_EASING, RETURN_EASING } from './easing';
import type { OpenGeometry } from './geometry';
import type { TransitionPose } from './opening';
import {
  OPEN_COVER_DURATION_MS,
  OPEN_HANDOFF_DURATION_MS,
  REDUCED_MOTION_CROSSFADE_MS,
  stageProgress,
  turnDuration,
} from './opening';
import { CLOSED_PERSPECTIVE_PX, perspectiveOriginInBook } from './projection';
import { slerpQuat } from './quaternion';
import type { CoverSide, Orientation } from './rotation';
import { facingOrientation, restOrientation } from './rotation';
import type { TurnSetup } from './turn-session';
import { MIN_DRAG_ORIGIN_RATIO } from './turn-session';

/**
 * 펼친 책을 다시 덮기(2026-11-16 사용자 결정 A). 두 부분으로 나눈다.
 *
 * 1. 끌어 덮기(CoverDrag): 양 끝 펼침에서 덮는 쪽으로 끌면 표지(덮이는 쪽 장들과 함께)가 딱딱한 판처럼 책등을 축으로 돈다.
 *    접히지 않는다. 좌표·배율·속도는 넘김 세션(turn-session.ts)과 같은 모델 좌표 규칙을 쓴다:
 *    판 바깥 가장자리가 보일 모델 x = 쪽 폭 - (누른 점 x - 손가락 x) × 배율이다. 진행도는 무대 원근(projection.ts)까지 넣어
 *    판 끝이 화면에서 그 자리에 보이는 각도다(coverDragProgress). 판이 막 들릴 때와 거의 덮일 때는 원근 때문에 판 끝을
 *    손가락 아래에 둘 수 없어(들리면 바깥으로 밀려 보인다) 직교 진행도 acos(가장자리 x / 쪽 폭) / π로 이어 붙인다.
 *    놓으면 넘김과 같은 놓기 판정(decideRelease: 진행도 0.5 또는 넘기는 방향 속도 0.3px/ms)으로 덮기 완주 또는 복귀다.
 *    복귀(CoverReturn)는 남은 각도만큼 표지 열기와 같은 시간·이징으로 다시 연다.
 * 2. 덮기 전환(ClosingTimeline): 펼침(opening.ts)을 거꾸로 재생한다. DOM → 3D 넘겨주기 → 표지 닫힘(책이 닫힌 자리로 옮겨 감)
 *    → 쉬는 자세로 돌기. 끌어 덮다 놓아 완주하면 이미 3D라 넘겨주기 없이 놓은 각도에서 이어 닫는다.
 *    동작 줄이기면 펼친 책 DOM이 사라지고 쉬는 자세의 닫힌 책이 나타나는 투명도 교차만 한다.
 * 모션 값은 펼침과 같은 계열의 임시값이다(open-decisions G3 "모션 기준").
 */

/** 넘김 방향 → 그 끝에서 덮이는 표지. 첫 펼침에서 뒤로 넘기면 앞표지, 마지막 펼침에서 앞으로 넘기면 뒤표지다. */
export function coverSideFor(direction: TurnDirection): CoverSide {
  return direction === 'backward' ? 'front' : 'back';
}

/**
 * 끄는 동안 판을 그리는 무대 원근(모델 좌표). 판은 펼친 쪽 자리(z = 0)에서 책등을 축으로 돌고, 판 끝은 들릴수록
 * 보는 사람 쪽(z > 0)으로 와서 원근 원점에서 멀어져 보인다(projection.ts와 같은 식: x' = o + (x - o)·D/(D - z)).
 */
export type CoverLens = {
  readonly distance: number;
  /** 원근 원점의 모델 x. */
  readonly originX: number;
};

/**
 * 판 끝을 손가락 아래에 두는 정도가 양 끝에서 풀리는 폭(직교 진행도 기준). 판이 막 들리거나 거의 덮일 때는 판 끝이
 * 원근 때문에 바깥으로 밀려 보여, 손가락 아래에 두려면 판이 한 번에 크게 들려야 한다(끌기 시작에 약 20° 튐).
 * 그래서 직교 진행도가 이 폭 안이면 원근 보정을 smoothstep으로 줄여 0과 1에서 이어지게 한다.
 * 임시, open-decisions G3 "넘김 감각 수치(완주 판정, 속도 임계, easing)".
 */
export const COVER_DRAG_TRACKING_RAMP = 0.25;

export type CoverDragSetup = TurnSetup & { readonly lens: CoverLens };

export type CoverDrag = CoverDragSetup & {
  /** 누른 점(모델 좌표). */
  readonly origin: Vec2;
  /** 손가락 수평 이동 → 판 가장자리 수평 이동 배율. 넘김과 같은 규칙(상한 2). */
  readonly scale: number;
  /** 판 바깥 가장자리가 화면에 보일 모델 x. 쪽 폭이면 다 열림, -쪽 폭이면 덮임. */
  readonly edgeX: number;
  /** 손가락 위치 표본(모델 좌표). 놓기 속도에 쓴다. */
  readonly samples: readonly PointerSample[];
};

/** 무대 원근을 모델 좌표로 옮긴다. 원점은 펼친 책 기준(projection.ts perspectiveOriginInBook)이다. */
export function coverLens(setup: TurnSetup, open: OpenGeometry): CoverLens {
  const origin = toModelPoint({ x: perspectiveOriginInBook(open), y: 0 }, setup.frame, setup.direction);
  return { distance: CLOSED_PERSPECTIVE_PX, originX: origin.x };
}

function edgeFor(drag: Pick<CoverDrag, 'origin' | 'scale' | 'page'>, finger: Vec2): number {
  const width = drag.page.width;
  const edge = width - (drag.origin.x - finger.x) * drag.scale;
  return Math.min(Math.max(edge, -width), width);
}

/** origin·point는 책 좌표다. */
export function beginCoverDrag(setup: CoverDragSetup, origin: Vec2, point: Vec2, time: number): CoverDrag {
  const { frame, direction, page } = setup;
  const originModel = toModelPoint(origin, frame, direction);
  const scale = page.width / Math.max(originModel.x, page.width * MIN_DRAG_ORIGIN_RATIO);
  const finger = toModelPoint(point, frame, direction);
  const base = { ...setup, origin: originModel, scale };
  return { ...base, edgeX: edgeFor(base, finger), samples: [{ x: finger.x, y: finger.y, t: time }] };
}

export function continueCoverDrag(drag: CoverDrag, point: Vec2, time: number): CoverDrag {
  const finger = toModelPoint(point, drag.frame, drag.direction);
  return {
    ...drag,
    edgeX: edgeFor(drag, finger),
    samples: retainSamplesForWindow([...drag.samples, { x: finger.x, y: finger.y, t: time }]),
  };
}

/**
 * 판 끝이 화면에서 모델 x = edgeX에 보이는 덮인 정도. 덮인 정도 p에서 판 끝은 (쪽 폭·cos πp, z = 쪽 폭·sin πp)에 있고
 * 화면에는 o + (x - o)·D/(D - z)로 보인다. 그 역: 눈(원근 원점, 거리 D)에서 그 점으로 쏜 시선이 판 끝이 도는 원
 * (책등 중심, 반지름 = 쪽 폭)과 처음 만나는 점의 각도다. 손가락이 쪽 안에 있으면 시선은 원과 늘 만난다.
 */
function perspectiveProgress(edgeX: number, width: number, lens: CoverLens): number {
  const { originX: o, distance: d } = lens;
  const run = edgeX - o;
  const a = run * run + d * d;
  const b = 2 * (o * run - d * d);
  const c = o * o + d * d - width * width;
  const t = (-b - Math.sqrt(Math.max(b * b - 4 * a * c, 0))) / (2 * a);
  return Math.atan2(d * (1 - t), o + run * t) / Math.PI;
}

function smoothstep(edge: number, value: number): number {
  const ratio = Math.min(Math.max(value / edge, 0), 1);
  return ratio * ratio * (3 - 2 * ratio);
}

/**
 * 덮인 정도. 0이면 다 열림, 1이면 덮임. 가운데(직교 진행도 COVER_DRAG_TRACKING_RAMP..1-그 값)에서는 판 끝이 원근까지 넣어
 * 손가락(edgeX) 아래에 보인다. 양 끝에서는 직교 진행도 acos(edgeX / 쪽 폭) / π로 이어진다.
 */
export function coverDragProgress(drag: CoverDrag): number {
  const width = drag.page.width;
  const flat = Math.acos(drag.edgeX / width) / Math.PI;
  const tracking = smoothstep(COVER_DRAG_TRACKING_RAMP, flat) * smoothstep(COVER_DRAG_TRACKING_RAMP, 1 - flat);
  if (tracking === 0) {
    return flat;
  }
  return flat + (perspectiveProgress(drag.edgeX, width, drag.lens) - flat) * tracking;
}

/** 놓기. 넘김과 같은 놓기 판정을 쓴다. 동작 줄이기에서도 같다(그리는 방식만 다르다). */
export function releaseCoverDrag(
  drag: CoverDrag,
  point: Vec2,
  time: number,
  config: ReleaseConfig = DEFAULT_RELEASE_CONFIG
): { readonly progress: number; readonly outcome: ReleaseOutcome } {
  const moved = continueCoverDrag(drag, point, time);
  const progress = coverDragProgress(moved);
  return { progress, outcome: decideRelease({ progress, velocity: estimateVelocity(moved.samples) }, config) };
}

/** 놓아서(또는 포인터를 잃어) 다시 펼쳐지는 동안. from은 놓은 순간의 덮인 정도다. */
export type CoverReturn = {
  readonly from: number;
  readonly startTime: number | null;
  readonly elapsedMs: number;
};

export function startCoverReturn(from: number): CoverReturn {
  return { from, startTime: null, elapsedMs: 0 };
}

function coverReturnDuration(cover: CoverReturn): number {
  return OPEN_COVER_DURATION_MS * cover.from;
}

export function advanceCoverReturn(cover: CoverReturn, time: number): CoverReturn {
  const startTime = cover.startTime ?? time;
  return { ...cover, startTime, elapsedMs: Math.max(time - startTime, 0) };
}

/** 지금 덮인 정도. 표지 열기와 같은 이징으로 0까지 연다. */
export function coverReturnProgress(cover: CoverReturn): number {
  return cover.from * (1 - OPEN_EASING(stageProgress(cover.elapsedMs, coverReturnDuration(cover))));
}

export function isCoverReturnDone(cover: CoverReturn): boolean {
  return cover.startTime !== null && cover.elapsedMs >= coverReturnDuration(cover);
}

/**
 * 끄는 중·되돌아가는 중의 3D 책 자세. 책은 펼친 쪽 자리(travel 1)에 그대로 있고 표지 판만 돈다.
 * 동작 줄이기면 판을 돌리지 않고, 펼친 책 DOM과 쉬는 자세의 닫힌 책을 덮인 정도만큼 교차한다(넘김의 동작 줄이기와 같은 방식).
 */
export function coverPose(side: CoverSide, progress: number, reducedMotion: boolean): TransitionPose {
  if (reducedMotion) {
    return {
      orientation: restOrientation(side),
      side,
      coverOpen: 0,
      travel: 0,
      handoff: 1 - progress,
      crossfade: true,
    };
  }
  return {
    orientation: facingOrientation(side),
    side,
    coverOpen: 1 - progress,
    travel: 1,
    handoff: 0,
    crossfade: false,
  };
}

export type ClosingTimeline = {
  readonly side: CoverSide;
  /** 시작할 때 표지 판이 열린 정도. 버튼·키·이름이면 1, 끌다 놓아 완주하면 놓은 자리. */
  readonly fromCoverOpen: number;
  /** 펼친 책 DOM → 3D 책 교차 시간. 끌어 덮다 완주하면 이미 3D라 0이다. 동작 줄이기면 교차 전체 시간이다. */
  readonly handoffMs: number;
  readonly coverMs: number;
  /** 표지가 정면을 보는 자세(덮인 직후). */
  readonly from: Orientation;
  /** 덮은 뒤 쉬는 자세. 닫힌 책이 이 자세를 기억한다. */
  readonly to: Orientation;
  readonly returnMs: number;
  readonly crossfade: boolean;
};

export type ClosingStart = {
  readonly coverOpen: number;
  /** 펼친 책 DOM에서 시작하는가(넘겨주기가 필요한가). */
  readonly fromDom: boolean;
  readonly reducedMotion: boolean;
};

export function createClosingTimeline(side: CoverSide, start: ClosingStart): ClosingTimeline {
  const to = restOrientation(side);
  if (start.reducedMotion) {
    return {
      side,
      fromCoverOpen: 0,
      handoffMs: REDUCED_MOTION_CROSSFADE_MS,
      coverMs: 0,
      from: to,
      to,
      returnMs: 0,
      crossfade: true,
    };
  }
  const from = facingOrientation(side);
  return {
    side,
    fromCoverOpen: start.coverOpen,
    handoffMs: start.fromDom ? OPEN_HANDOFF_DURATION_MS : 0,
    coverMs: OPEN_COVER_DURATION_MS,
    from,
    to,
    returnMs: turnDuration(from, to),
    crossfade: false,
  };
}

export function closingDuration(timeline: ClosingTimeline): number {
  return timeline.handoffMs + timeline.coverMs + timeline.returnMs;
}

export function isClosingDone(timeline: ClosingTimeline, elapsedMs: number): boolean {
  return elapsedMs >= closingDuration(timeline);
}

/**
 * 표지 닫기는 펼침 이징을 시간 순서 그대로 쓴다: 누르는 즉시 빠르게 닫히다 천천히 붙는다(약 0.1초에 3분의 2).
 * 2026-11-16 사용자 결정. 펼침을 시간으로 뒤집은 역재생(천천히 출발해 마지막에 탁 닫힘)은 실험 패널(지금은 뺐다)로 비교했고,
 * 처음 약 0.4초 동안 거의 움직이지 않아 앱이 느리다고 느껴져 뺐다. 닫기 시간(650ms)은 임시, open-decisions G3 "모션 기준".
 */
export function closingPoseAt(timeline: ClosingTimeline, elapsedMs: number): TransitionPose {
  const { side, crossfade, handoffMs, coverMs } = timeline;
  const handoff = handoffMs > 0 ? 1 - stageProgress(elapsedMs, handoffMs) : 0;
  if (crossfade) {
    return { orientation: timeline.to, side, coverOpen: 0, travel: 0, handoff, crossfade };
  }
  const coverElapsed = elapsedMs - handoffMs;
  if (coverElapsed <= coverMs) {
    const closed = coverElapsed <= 0 ? 0 : OPEN_EASING(stageProgress(coverElapsed, coverMs));
    return {
      orientation: timeline.from,
      side,
      coverOpen: timeline.fromCoverOpen * (1 - closed),
      travel: 1 - closed,
      handoff,
      crossfade,
    };
  }
  const turn = RETURN_EASING(stageProgress(coverElapsed - coverMs, timeline.returnMs));
  return {
    orientation: slerpQuat(timeline.from, timeline.to, turn),
    side,
    coverOpen: 0,
    travel: 0,
    handoff,
    crossfade,
  };
}
