import { OPEN_EASING, RETURN_EASING } from './easing';
import type { Rotation } from './rotation';
import { angularDistance, frontRotation, interpolateRotation } from './rotation';

/**
 * 닫힌 책 → 펼친 책 전환의 시간표.
 *
 * 움직임이 있을 때(기본):
 * 1. 앞으로 돌기: 보던 각도에서 앞면이 정면을 보는 포즈로 돈다. 뒷면을 보던 중 클릭해도 앞면으로 돌아온 뒤 연다.
 *    임시, open-decisions G3 "뒷면을 보던 중 클릭했을 때의 펼침 동작".
 * 2. 표지 열기: 앞표지가 책등(왼쪽 가장자리)을 축으로 0° → -180° 열리고, 동시에 책이 닫힌 자리·크기에서
 *    펼친 책의 쪽 자리·크기로 옮겨 간다(travel 0 → 1).
 * 3. 넘겨주기(handoff): 표지 열기의 마지막 handoffMs 동안 3D 책을 최종 자세에 맞춰 두고(남은 움직임 1px 미만),
 *    그 아래에 변환 없는 펼친 책 DOM을 그린 채 3D 책의 투명도를 1 → 0으로 줄인다. 3D 면을 래스터한 글자·사진과
 *    DOM 글자·사진의 선명도 차이가 한 프레임에 바뀌지 않게 하려는 것이다(spikes.md S3-9).
 *
 * 동작 줄이기(crossfade): 돌기·열기 없이 닫힌 책은 그 자리에서 사라지고 펼친 책이 나타나는 투명도 교차만 한다
 * (tech-research.md 7장, 투명도 변화는 WCAG 2.3.3의 모션 애니메이션이 아니다).
 * 시간은 경과 ms로만 정한다(주사율 무관).
 */
export type OpeningTimeline = {
  readonly from: Rotation;
  readonly to: Rotation;
  readonly returnMs: number;
  readonly coverMs: number;
  /** 3D 책 → 펼친 책 DOM 교차 시간. 움직임 끝(returnMs + coverMs)에서 이만큼 앞서 시작한다. */
  readonly handoffMs: number;
  /** true면 동작 줄이기: 움직이지 않고 두 화면의 투명도만 바꾼다. */
  readonly crossfade: boolean;
};

export type OpeningPose = {
  readonly rotation: Rotation;
  /** 앞표지가 열린 각도(deg). 0이면 닫힘, -180이면 왼쪽으로 완전히 열림. */
  readonly coverAngle: number;
  /** 닫힌 자리(0)에서 펼친 쪽 자리(1)까지 옮겨 간 정도. */
  readonly travel: number;
  /** 0이면 3D 책만 그린다. 0보다 크면 펼친 책 DOM도 그리고 3D 책 투명도는 1 - handoff다. */
  readonly handoff: number;
  /** 동작 줄이기 교차면 펼친 책 DOM의 투명도도 handoff다(아니면 1). */
  readonly crossfade: boolean;
};

/** 표지 열기 시간. 임시, open-decisions G3 "모션 기준(표지 열림과 넘김)"(ryo.lu 0.65s 후보). */
export const OPEN_COVER_DURATION_MS = 650;

/**
 * 90°를 도는 데 쓰는 앞으로 돌기 시간. 더 적게 돌면 비례해서 줄고, 90°를 넘으면 이 시간에서 멈춘다.
 * 임시, open-decisions G3 "뒷면을 보던 중 클릭했을 때의 펼침 동작"·"모션 기준".
 */
export const RETURN_TO_FRONT_DURATION_MS = 650;
const RETURN_REFERENCE_DEGREES = 90;

/** 3D 책 → DOM 교차 시간. 임시, open-decisions G3 "모션 기준"·G2 "3D→HTML 전환 지점". */
export const OPEN_HANDOFF_DURATION_MS = 120;

/**
 * 동작 줄이기에서 닫힌 책 → 펼친 책 투명도 교차 시간. 넘김 쪽 투명도 전환(book-spread.css 160ms)과 같은 값.
 * 임시, open-decisions G2 "reduced motion에서 드래그 넘김 중 보이는 것"(tech-research.md 7장 U7).
 */
export const REDUCED_MOTION_CROSSFADE_MS = 160;

/** 표지가 완전히 열린 각도. 책등을 축으로 왼쪽 쪽 자리에 눕는다(펼친 책의 1쪽 자리, 각도 자체는 정해진 기하). */
export const OPEN_COVER_ANGLE_DEG = -180;

export function createOpeningTimeline(from: Rotation, reducedMotion = false): OpeningTimeline {
  if (reducedMotion) {
    return { from, to: from, returnMs: 0, coverMs: 0, handoffMs: REDUCED_MOTION_CROSSFADE_MS, crossfade: true };
  }
  const to = frontRotation(from);
  const distanceRatio = Math.min(angularDistance(from, to) / RETURN_REFERENCE_DEGREES, 1);
  return {
    from,
    to,
    returnMs: RETURN_TO_FRONT_DURATION_MS * distanceRatio,
    coverMs: OPEN_COVER_DURATION_MS,
    handoffMs: OPEN_HANDOFF_DURATION_MS,
    crossfade: false,
  };
}

function motionDuration(timeline: OpeningTimeline): number {
  return timeline.returnMs + timeline.coverMs;
}

function handoffStart(timeline: OpeningTimeline): number {
  return Math.max(motionDuration(timeline) - timeline.handoffMs, 0);
}

export function openingDuration(timeline: OpeningTimeline): number {
  return Math.max(motionDuration(timeline), handoffStart(timeline) + timeline.handoffMs);
}

function clampUnit(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function stageProgress(elapsedMs: number, durationMs: number): number {
  return durationMs <= 0 ? 1 : clampUnit(elapsedMs / durationMs);
}

export function openingPoseAt(timeline: OpeningTimeline, elapsedMs: number): OpeningPose {
  const start = handoffStart(timeline);
  const handoff = elapsedMs < start ? 0 : stageProgress(elapsedMs - start, timeline.handoffMs);
  const { crossfade } = timeline;
  if (crossfade) {
    return { rotation: timeline.from, coverAngle: 0, travel: 0, handoff, crossfade };
  }
  if (handoff > 0) {
    // 넘겨주는 동안은 최종 자세에 맞춘다. 펼친 책 DOM과 같은 자리에 겹쳐야 투명도 교차가 흐려지지 않는다.
    return { rotation: timeline.to, coverAngle: OPEN_COVER_ANGLE_DEG, travel: 1, handoff, crossfade };
  }
  const turn = RETURN_EASING(stageProgress(elapsedMs, timeline.returnMs));
  const open =
    elapsedMs <= timeline.returnMs ? 0 : OPEN_EASING(stageProgress(elapsedMs - timeline.returnMs, timeline.coverMs));
  return {
    rotation: interpolateRotation(timeline.from, timeline.to, turn),
    coverAngle: OPEN_COVER_ANGLE_DEG * open,
    travel: open,
    handoff,
    crossfade,
  };
}

export function isOpeningDone(timeline: OpeningTimeline, elapsedMs: number): boolean {
  return elapsedMs >= openingDuration(timeline);
}
