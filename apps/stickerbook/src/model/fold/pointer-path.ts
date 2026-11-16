import { clampUnit } from './progress';
import type { Vec2 } from './vector';
import { addVec, lerpVec, scaleVec } from './vector';

/**
 * 가상 포인터 경로. 클릭 넘김과 놓은 뒤 착지가 쓴다. 좌표는 모델 좌표(book-frame.ts)다.
 *
 * 경로 위치는 경과 시간(ms)으로만 정한다. 프레임 수를 세지 않으므로 30·60·120Hz 어느 주사율에서
 * 샘플링해도 같은 시각에는 같은 점이 나온다(tech-research.md 0장 "easing은 경과 시간 기준").
 * 적분하는 시뮬레이션이 없어서 고정 timestep이 필요 없다.
 *
 * 경로: P(s) = lerp(from, to, s) + liftOffset · sin(π·s), s = easing(경과 / duration).
 * sin(π·s)는 s=0과 s=1에서 0이라 시작과 끝은 정확히 from, to다.
 */
export type PointerPath = {
  readonly from: Vec2;
  readonly to: Vec2;
  /** 경로 한가운데(s=0.5)에서 직선 경로에 더해지는 어긋남(px). (0, 0)이면 직선이다. */
  readonly liftOffset: Vec2;
};

/** [0, 1] → [0, 1]. easing(0) = 0, easing(1) = 1이어야 경로 끝점이 맞는다. */
export type Easing = (linearProgress: number) => number;

export type PathTiming = {
  /** 0 이하면 바로 끝점이다(경과 시간과 무관). */
  readonly durationMs: number;
  readonly easing: Easing;
};

export const linearEasing: Easing = linearProgress => linearProgress;

/** Mantine Book 프로그램 넘김이 쓰는 easeOutCubic(tech-research.md 3장 참고값). */
export const easeOutCubic: Easing = linearProgress => {
  const remaining = 1 - linearProgress;
  return 1 - remaining * remaining * remaining;
};

/**
 * 넘김 경로 시간. 임시 후보값, G3 사용자 결정(open-decisions.md G3 넘김 감각 수치·모션 기준).
 * 참고값: Mantine Book 프로그램 넘김 easeOutCubic 1000ms, 이전 구현 160–280ms, ryo.lu 전환 650ms.
 */
export const DEFAULT_TURN_TIMING: PathTiming = {
  durationMs: 1000,
  easing: easeOutCubic,
};

/** 경과 시간 → easing을 거친 경로 매개변수 s. 경과 시간은 [0, duration]으로 자른다. */
export function pathParameterAt(elapsedMs: number, timing: PathTiming): number {
  if (timing.durationMs <= 0) {
    return 1;
  }
  return timing.easing(clampUnit(elapsedMs / timing.durationMs));
}

/**
 * 경로 매개변수 s의 점. s가 정확히 0이나 1이면 끝점을 그대로 돌려준다.
 * Math.sin(Math.PI)는 0이 아니라 약 1.2e-16이어서, 그대로 계산하면 끝점이 아주 조금 어긋난다.
 */
export function pointOnPath(path: PointerPath, pathParameter: number): Vec2 {
  if (pathParameter === 0) {
    return path.from;
  }
  if (pathParameter === 1) {
    return path.to;
  }
  const straight = lerpVec(path.from, path.to, pathParameter);
  return addVec(straight, scaleVec(path.liftOffset, Math.sin(Math.PI * pathParameter)));
}

/** 경과 시간 elapsedMs의 가상 포인터 위치. */
export function samplePointerPath(path: PointerPath, elapsedMs: number, timing: PathTiming): Vec2 {
  return pointOnPath(path, pathParameterAt(elapsedMs, timing));
}

export function isPathFinished(elapsedMs: number, timing: PathTiming): boolean {
  return elapsedMs >= timing.durationMs;
}
