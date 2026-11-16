import { OPEN_EASING, RETURN_EASING } from './easing';
import type { Quat } from './quaternion';
import { angleBetweenQuat, slerpQuat } from './quaternion';
import type { CoverSide, Orientation } from './rotation';
import { facingOrientation } from './rotation';

/**
 * 닫힌 책 → 펼친 책 전환의 시간표.
 *
 * 움직임이 있을 때(기본):
 * 1. 앞으로 돌기: 보던 자세에서 앞면이 정면을 보는 자세로 쿼터니언 slerp로 돈다(가장 짧은 길). 뒷면·윗면을 보던 중 눌러도
 *    앞면으로 돌아온 뒤 연다. 임시, open-decisions G3 "뒷면을 보던 중 클릭했을 때의 펼침 동작".
 * 2. 표지 열기: 앞표지가 책등(왼쪽 가장자리)을 축으로 열리고(coverOpen 0 → 1), 동시에 책이 닫힌 자리·크기에서
 *    펼친 책의 쪽 자리·크기로 옮겨 간다(travel 0 → 1).
 * 3. 넘겨주기(handoff): 표지 열기의 마지막 handoffMs 동안 3D 책을 최종 자세에 맞춰 두고(남은 움직임 1px 미만),
 *    그 아래에 변환 없는 펼친 책 DOM을 그린 채 3D 책의 투명도를 1 → 0으로 줄인다. 3D 면을 래스터한 글자·사진과
 *    DOM 글자·사진의 선명도 차이가 한 프레임에 바뀌지 않게 하려는 것이다(spikes.md S3-9).
 *
 * 동작 줄이기(crossfade): 돌기·열기 없이 닫힌 책은 그 자리에서 사라지고 펼친 책이 나타나는 투명도 교차만 한다
 * (tech-research.md 7장, 투명도 변화는 WCAG 2.3.3의 모션 애니메이션이 아니다).
 * 시간은 경과 ms로만 정한다(주사율 무관). 덮기(closing.ts)는 같은 자세 형식으로 이 전환을 거꾸로 재생한다.
 */
export type OpeningTimeline = {
  readonly from: Orientation;
  readonly to: Orientation;
  readonly returnMs: number;
  readonly coverMs: number;
  /** 3D 책 → 펼친 책 DOM 교차 시간. 움직임 끝(returnMs + coverMs)에서 이만큼 앞서 시작한다. */
  readonly handoffMs: number;
  /** true면 동작 줄이기: 움직이지 않고 두 화면의 투명도만 바꾼다. */
  readonly crossfade: boolean;
};

/** 펼침·덮기 전환 중 한 순간의 3D 책 자세. 닫힌 책 컴포넌트가 그린다. */
export type TransitionPose = {
  readonly orientation: Quat;
  /** 여닫는 표지. 펼침은 언제나 앞표지다. */
  readonly side: CoverSide;
  /** 표지 판이 열린 정도. 0이면 닫힘, 1이면 책등 건너편 쪽 자리에 다 열려 누움. */
  readonly coverOpen: number;
  /** 닫힌 자리(0)에서 펼친 쪽 자리(1)까지 옮겨 간 정도. */
  readonly travel: number;
  /** 펼친 책 DOM의 몫. 0이면 3D 책만 그린다. 0보다 크면 펼친 책 DOM도 그리고 3D 책 투명도는 1 - handoff다. */
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
 * 동작 줄이기에서 닫힌 책 ↔ 펼친 책 투명도 교차 시간. 넘김 쪽 투명도 전환(book-spread.css 160ms)과 같은 값.
 * 임시, open-decisions G2 "reduced motion에서 드래그 넘김 중 보이는 것"(tech-research.md 7장 U7).
 */
export const REDUCED_MOTION_CROSSFADE_MS = 160;

/** 두 자세 사이를 도는 시간. 90°에 RETURN_TO_FRONT_DURATION_MS, 더 적게 돌면 비례해서 줄고 90°를 넘으면 그대로다. */
export function turnDuration(from: Orientation, to: Orientation): number {
  return RETURN_TO_FRONT_DURATION_MS * Math.min(angleBetweenQuat(from, to) / RETURN_REFERENCE_DEGREES, 1);
}

export function createOpeningTimeline(from: Orientation, reducedMotion = false): OpeningTimeline {
  if (reducedMotion) {
    return { from, to: from, returnMs: 0, coverMs: 0, handoffMs: REDUCED_MOTION_CROSSFADE_MS, crossfade: true };
  }
  const to = facingOrientation('front');
  return {
    from,
    to,
    returnMs: turnDuration(from, to),
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

/** 단계 진행 비율. 길이가 0인 단계는 바로 끝난 것으로 본다. */
export function stageProgress(elapsedMs: number, durationMs: number): number {
  return durationMs <= 0 ? 1 : clampUnit(elapsedMs / durationMs);
}

export function openingPoseAt(timeline: OpeningTimeline, elapsedMs: number): TransitionPose {
  const start = handoffStart(timeline);
  const handoff = elapsedMs < start ? 0 : stageProgress(elapsedMs - start, timeline.handoffMs);
  const { crossfade } = timeline;
  const side: CoverSide = 'front';
  if (crossfade) {
    return { orientation: timeline.from, side, coverOpen: 0, travel: 0, handoff, crossfade };
  }
  if (handoff > 0) {
    // 넘겨주는 동안은 최종 자세에 맞춘다. 펼친 책 DOM과 같은 자리에 겹쳐야 투명도 교차가 흐려지지 않는다.
    return { orientation: timeline.to, side, coverOpen: 1, travel: 1, handoff, crossfade };
  }
  const turn = RETURN_EASING(stageProgress(elapsedMs, timeline.returnMs));
  const open =
    elapsedMs <= timeline.returnMs ? 0 : OPEN_EASING(stageProgress(elapsedMs - timeline.returnMs, timeline.coverMs));
  return {
    orientation: slerpQuat(timeline.from, timeline.to, turn),
    side,
    coverOpen: open,
    travel: open,
    handoff,
    crossfade,
  };
}

export function isOpeningDone(timeline: OpeningTimeline, elapsedMs: number): boolean {
  return elapsedMs >= openingDuration(timeline);
}
