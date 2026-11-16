import type { PointerPath } from './pointer-path';
import { pointerXForProgress } from './progress';
import type { Vec2 } from './vector';

/**
 * 놓기 판정. 좌표는 모델 좌표(book-frame.ts)다. 모델 좌표에서 넘기는 방향은 -x다.
 *
 * 규칙: 진행도 >= commitProgress 이거나, 넘기는 방향 속도(-velocity.x, px/ms) >= velocityThreshold면
 * 완주('complete'), 아니면 복귀('return')다(tech-research.md 3장, spikes.md S2-9).
 * 경계값과 같으면 완주다. 속도는 px/ms라 주사율과 무관하다(velocity.ts).
 *
 * 진행도가 commitProgress를 넘은 뒤 반대로 빠르게 튕기며 놓아도 위 규칙대로 완주다.
 * 반대 방향 튕김을 복귀로 볼지는 감각 결정이라 여기서 정하지 않았다.
 */
export type ReleaseConfig = {
  /** [0, 1]. progress.ts 정의의 진행도. */
  readonly commitProgress: number;
  /** px/ms. 넘기는 방향(모델 -x) 속도. */
  readonly velocityThreshold: number;
};

export type ReleaseOutcome = 'complete' | 'return';

/**
 * 완주 진행도. 후보값, G3 사용자 결정(open-decisions.md G3 넘김 감각 수치).
 * 참고값: @vysmo/flipbook `dragCommit` 0.5. 바깥 가장자리를 잡았다면 StPageFlip의 "책등을 넘었는가"와 같다.
 */
export const DEFAULT_COMMIT_PROGRESS = 0.5;

/**
 * 완주 속도 임계(px/ms). 후보값, G3 사용자 결정(open-decisions.md G3 넘김 감각 수치).
 * 참고값: Hammer.js swipe 인식기 기본 velocity 0.3 px/ms(hammerjs.github.io/recognizer-swipe, 2026-11-13 확인).
 * Mantine Book의 "빠른 스와이프" 수치는 확인하지 않았다.
 */
export const DEFAULT_VELOCITY_THRESHOLD_PX_PER_MS = 0.3;

export const DEFAULT_RELEASE_CONFIG: ReleaseConfig = {
  commitProgress: DEFAULT_COMMIT_PROGRESS,
  velocityThreshold: DEFAULT_VELOCITY_THRESHOLD_PX_PER_MS,
};

/** 넘기는 방향 속도(px/ms). 모델 좌표에서 -x 성분이다. */
export function turningSpeed(velocity: Vec2): number {
  return -velocity.x;
}

export function decideRelease(
  release: { readonly progress: number; readonly velocity: Vec2 },
  config: ReleaseConfig = DEFAULT_RELEASE_CONFIG
): ReleaseOutcome {
  if (release.progress >= config.commitProgress) {
    return 'complete';
  }
  if (turningSpeed(release.velocity) >= config.velocityThreshold) {
    return 'complete';
  }
  return 'return';
}

/**
 * 놓은 뒤 착지 경로. 완주면 거울 위치(진행도 1), 복귀면 잡은 점(진행도 0)으로 직선으로 간다.
 * 경과 시간 샘플링과 시간·easing은 pointer-path.ts를 따른다. 착지 시간은 호출부가 정한다.
 */
export function createSettlePath(grab: Vec2, releasedPointer: Vec2, outcome: ReleaseOutcome): PointerPath {
  const target = outcome === 'complete' ? { x: pointerXForProgress(grab.x, 1), y: grab.y } : grab;
  return { from: releasedPointer, to: target, liftOffset: { x: 0, y: 0 } };
}
