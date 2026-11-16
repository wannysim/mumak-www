import type {
  BookFrame,
  PageSize,
  PathTiming,
  PointerPath,
  PointerSample,
  ReleaseConfig,
  ReleaseOutcome,
  TurnDirection,
  TurnPose,
  Vec2,
} from '@/model/fold';
import {
  computeTurnPose,
  createClickTurnPath,
  createSettlePath,
  decideRelease,
  DEFAULT_RELEASE_CONFIG,
  DEFAULT_TURN_TIMING,
  estimateVelocity,
  isPathFinished,
  projectToOuterEdge,
  retainSamplesForWindow,
  samplePointerPath,
  toModelPoint,
} from '@/model/fold';

/**
 * 한 장을 넘기는 동안의 상태. fold 모델(src/model/fold) 흐름을 그대로 쓴다:
 * 누른 점 → projectToOuterEdge로 잡은 점 → 드래그 포인터 또는 클릭 경로의 가상 포인터 → computeTurnPose
 * (책등 제한 → 반사 접힘 → 진행도) → 놓으면 estimateVelocity·decideRelease → createSettlePath로 착지.
 *
 * - 좌표는 입력이 책 좌표(book-local), 저장은 모델 좌표다. 시간은 ms다.
 * - 자동 구간(클릭 넘김과 놓은 뒤 착지)은 첫 프레임 시각을 시작으로 삼고 경과 시간으로만 위치를 정한다.
 *   그래서 30·60·120Hz 어디서 돌려도 같은 시각에 같은 자세다(tech-research.md 0장).
 * - 드래그는 손가락이 누른 점에서 움직인 만큼만 잡은 점을 옮긴다(첫 프레임에 한 번에 접히지 않는다).
 *   수평 이동에는 배율(바깥 가장자리 폭 ÷ 누른 점과 책등 사이 거리)을 곱해, 손가락이 책등에 닿을 때 진행도가 0.5가 되게 한다.
 *   바깥 가장자리를 누르면 배율 1로 fold 모델 흐름과 같다. 쪽 안쪽에서 시작하는 드래그(세로 휴대폰)도 같은 규칙이다.
 *   속도(놓기 판정)는 배율을 곱하지 않은 손가락 이동으로 잰다. 배율과 그 상한은 임시, open-decisions G3 "넘김 감각 수치".
 * - 포인터가 잡은 점보다 바깥(모델 x > 잡은 점 x)으로 나가면 잡은 점의 x로 자른다. 쪽이 바깥으로 뒤집혀 접히는
 *   자세를 만들지 않기 위해서다.
 */
export type TurnSetup = {
  readonly frame: BookFrame;
  readonly direction: TurnDirection;
  readonly page: PageSize;
};

type DragMotion = {
  readonly type: 'drag';
  /** 누른 점(모델 좌표). */
  readonly origin: Vec2;
  /** 손가락 수평 이동 → 잡은 점 수평 이동 배율. */
  readonly scale: number;
  /** 잡은 점이 옮겨 간 포인터(모델 좌표). */
  readonly pointer: Vec2;
  /** 손가락 위치 표본(모델 좌표). 놓기 속도에 쓴다. */
  readonly samples: readonly PointerSample[];
};

type SettleMotion = {
  readonly type: 'settle';
  readonly path: PointerPath;
  readonly timing: PathTiming;
  readonly outcome: ReleaseOutcome;
  /** 첫 프레임 시각. 아직 그리지 않았으면 null. */
  readonly startTime: number | null;
  readonly elapsedMs: number;
};

export type TurnSession = TurnSetup & {
  readonly grab: Vec2;
  readonly motion: DragMotion | SettleMotion;
};

/**
 * 버튼·키로 넘길 때 잡는 높이(쪽 높이 비율). 아래 모서리 근처를 잡아 넘긴다.
 * 임시, open-decisions G3 "넘김 감각 수치"·G2 "클릭 넘김 영역의 배치와 표시".
 */
export const DEFAULT_GRAB_HEIGHT_RATIO = 0.82;

/**
 * 드래그 배율을 정할 때 누른 점이 책등에서 이 비율(쪽 폭 대비)보다 가깝더라도 이 비율로 본다. 배율 상한이 1 / 이 값(2배)이다.
 * 임시, open-decisions G3 "넘김 감각 수치".
 */
export const MIN_DRAG_ORIGIN_RATIO = 0.5;

function startSettle(path: PointerPath, timing: PathTiming, outcome: ReleaseOutcome): SettleMotion {
  return { type: 'settle', path, timing, outcome, startTime: null, elapsedMs: 0 };
}

/**
 * 놓은 뒤 착지 시간. 남은 진행도에 비례한다(진행도 1 전체가 클릭 넘김과 같은 시간).
 * 임시, open-decisions G3 "넘김 감각 수치(완주 판정, 속도 임계, easing)". easing은 fold 모델 클릭 넘김과 같다.
 */
export function settleTiming(progress: number, outcome: ReleaseOutcome): PathTiming {
  const remaining = outcome === 'complete' ? 1 - progress : progress;
  return { durationMs: DEFAULT_TURN_TIMING.durationMs * remaining, easing: DEFAULT_TURN_TIMING.easing };
}

/** 클릭·버튼·키 넘김. press가 null이면(키보드) 바깥 가장자리 기본 높이를 잡는다. */
export function beginClickTurn(setup: TurnSetup, press: Vec2 | null): TurnSession {
  const { frame, direction, page } = setup;
  const pressModel =
    press === null
      ? { x: page.width, y: page.height * DEFAULT_GRAB_HEIGHT_RATIO }
      : toModelPoint(press, frame, direction);
  const grab = projectToOuterEdge(pressModel, page);
  return {
    ...setup,
    grab,
    motion: startSettle(createClickTurnPath(grab, page), DEFAULT_TURN_TIMING, 'complete'),
  };
}

/** 손가락(모델 좌표) → 잡은 점이 옮겨 간 포인터. */
function pointerForFinger(grab: Vec2, origin: Vec2, scale: number, finger: Vec2): Vec2 {
  return { x: grab.x - (origin.x - finger.x) * scale, y: grab.y + (finger.y - origin.y) };
}

export function beginDragTurn(setup: TurnSetup, origin: Vec2, point: Vec2, time: number): TurnSession {
  const { frame, direction, page } = setup;
  const originModel = toModelPoint(origin, frame, direction);
  const grab = projectToOuterEdge(originModel, page);
  const scale = page.width / Math.max(originModel.x, page.width * MIN_DRAG_ORIGIN_RATIO);
  const finger = toModelPoint(point, frame, direction);
  return {
    ...setup,
    grab,
    motion: {
      type: 'drag',
      origin: originModel,
      scale,
      pointer: pointerForFinger(grab, originModel, scale, finger),
      samples: [{ x: finger.x, y: finger.y, t: time }],
    },
  };
}

function dragMotionTo(session: TurnSession, motion: DragMotion, point: Vec2, time: number): DragMotion {
  const finger = toModelPoint(point, session.frame, session.direction);
  const samples = retainSamplesForWindow([...motion.samples, { x: finger.x, y: finger.y, t: time }]);
  return { ...motion, pointer: pointerForFinger(session.grab, motion.origin, motion.scale, finger), samples };
}

export function continueDragTurn(session: TurnSession, point: Vec2, time: number): TurnSession {
  if (session.motion.type !== 'drag') {
    return session;
  }
  return { ...session, motion: dragMotionTo(session, session.motion, point, time) };
}

/** 놓기. 같은 놓기 판정(decideRelease)을 동작 줄이기에서도 쓴다. 착지 경로는 동작 줄이기면 쓰지 않는다. */
export function releaseDragTurn(
  session: TurnSession,
  point: Vec2,
  time: number,
  config: ReleaseConfig = DEFAULT_RELEASE_CONFIG
): TurnSession {
  if (session.motion.type !== 'drag') {
    return session;
  }
  const motion = dragMotionTo(session, session.motion, point, time);
  const moved: TurnSession = { ...session, motion };
  const pose = currentTurnPose(moved);
  const outcome = decideRelease({ progress: pose.progress, velocity: estimateVelocity(motion.samples) }, config);
  return settleFrom(moved, pose, outcome);
}

/** 포인터를 잃으면(pointercancel) 복귀한다. */
export function cancelDragTurn(session: TurnSession): TurnSession {
  if (session.motion.type !== 'drag') {
    return session;
  }
  return settleFrom(session, currentTurnPose(session), 'return');
}

function settleFrom(session: TurnSession, pose: TurnPose, outcome: ReleaseOutcome): TurnSession {
  const path = createSettlePath(session.grab, pose.pointer, outcome);
  return { ...session, motion: startSettle(path, settleTiming(pose.progress, outcome), outcome) };
}

/** 프레임 시각을 받아 자동 구간의 경과 시간을 갱신한다. 드래그 중이면 그대로다. */
export function advanceTurn(session: TurnSession, time: number): TurnSession {
  if (session.motion.type !== 'settle') {
    return session;
  }
  const startTime = session.motion.startTime ?? time;
  return { ...session, motion: { ...session.motion, startTime, elapsedMs: Math.max(time - startTime, 0) } };
}

export function currentTurnPose(session: TurnSession): TurnPose {
  const { motion, grab, page } = session;
  const rawPointer =
    motion.type === 'drag' ? motion.pointer : samplePointerPath(motion.path, motion.elapsedMs, motion.timing);
  const pointer = { x: Math.min(rawPointer.x, grab.x), y: rawPointer.y };
  return computeTurnPose(grab, pointer, page);
}

export function isTurnSettled(session: TurnSession): boolean {
  const { motion } = session;
  return motion.type === 'settle' && motion.startTime !== null && isPathFinished(motion.elapsedMs, motion.timing);
}

/** 자동 구간이면 결과, 드래그 중이면 null. */
export function settleOutcome(session: TurnSession): ReleaseOutcome | null {
  return session.motion.type === 'settle' ? session.motion.outcome : null;
}
