import type { PageSize } from './book-frame';
import type { PointerPath } from './pointer-path';
import { pointerXForProgress } from './progress';
import type { Vec2 } from './vector';

/**
 * 클릭 넘김. 좌표는 모델 좌표(book-frame.ts)다.
 *
 * 클릭 위치를 바깥 가장자리에 투영해(turn-pose.ts projectToOuterEdge) 잡은 점으로 삼고, 가상 포인터가 잡은 점에서
 * 책등 건너편 거울 위치까지 약간 들어 올린 호를 따라 움직인다. 이 가상 포인터를 드래그 포인터와 같은
 * computeTurnPose에 넣으므로 클릭 넘김도 같은 곡면이 나온다(tech-research.md 3장, StPageFlip `flipNext` 패턴).
 * 경과 시간 샘플링은 pointer-path.ts의 samplePointerPath를 쓴다.
 *
 * 호는 책등 제한 렌즈(spine-limit.ts) 안에 머물도록 들어 올리는 거리를 줄인다. 그래서 computeTurnPose의
 * 책등 제한이 경로를 고치지 않고, 들어 올린 모양이 쪽 비율과 상관없이 그대로 나온다.
 * 근거: 위로 들 때 경로는 P(s) = (G.x·(1 - 2s), G.y - L·sin(πs))이고, 막는 원은 아래 끝점 원(반경 √(G.x² + a²),
 * a = 쪽 높이 - G.y)이다. cos(πu/2) <= 1 - u²(u = 1 - 2s)를 쓰면 L <= √(G.x² + a²) - a가 모든 s에서 충분하고,
 * s = 0.5(책등 위)에서 필요하다. 아래로 들 때는 위 끝점 원으로 같은 식(a = G.y)이다. 이때 L <= G.x라서
 * 반대쪽 원도 넘지 않는다.
 */
export type ClickTurnShape = {
  /**
   * 호를 들어 올리는 정도. 쪽 높이에 대한 비율이다. 0이면 직선으로 넘긴다.
   * 책등 제한 렌즈를 넘는 만큼은 줄인다(liftLimitInsideSpine).
   */
  readonly liftRatio: number;
};

/** 호 높이. 임시값, 모양은 사용자가 평면 DOM 접힘 기준선에서 보고 정한다(G3 모션 기준). */
export const DEFAULT_CLICK_TURN_SHAPE: ClickTurnShape = { liftRatio: 0.1 };

/** 잡은 점에서 거울 위치(진행도 1)까지 가는 클릭 넘김 경로. */
export function createClickTurnPath(
  grab: Vec2,
  page: PageSize,
  shape: ClickTurnShape = DEFAULT_CLICK_TURN_SHAPE
): PointerPath {
  // 드는 방향: 잡은 점에서 쪽 세로 가운데 쪽(아래 절반이면 위로, 위 절반이면 아래로, 정확히 가운데면 위로).
  // 임시 규칙, 모양은 G3 모션 기준에서 사용자가 정한다.
  const liftsUpward = grab.y >= page.height / 2;
  const liftDistance = Math.min(shape.liftRatio * page.height, liftLimitInsideSpine(grab, page, liftsUpward));
  return {
    from: grab,
    to: { x: pointerXForProgress(grab.x, 1), y: grab.y },
    liftOffset: { x: 0, y: liftsUpward ? -liftDistance : liftDistance },
  };
}

/**
 * 호가 책등 제한 렌즈 안에 머무는 가장 큰 들어 올림(px). √(G.x² + a²) - a를 a가 클 때 상쇄 오차가 없는
 * G.x² / (√(G.x² + a²) + a) 꼴로 계산한다. a는 드는 방향 반대쪽 책등 끝점까지의 세로 거리다.
 */
export function liftLimitInsideSpine(grab: Vec2, page: PageSize, liftsUpward: boolean): number {
  const verticalGapToOppositeEnd = liftsUpward ? page.height - grab.y : grab.y;
  const grabXSquared = grab.x * grab.x;
  const denominator =
    Math.sqrt(grabXSquared + verticalGapToOppositeEnd * verticalGapToOppositeEnd) + verticalGapToOppositeEnd;
  return denominator > 0 ? grabXSquared / denominator : 0;
}
