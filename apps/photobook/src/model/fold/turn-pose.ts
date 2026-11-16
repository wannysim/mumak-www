import type { PageSize } from './book-frame';
import { turnProgress } from './progress';
import type { FoldLine } from './reflect-fold';
import { createFoldLine } from './reflect-fold';
import { limitPointerToSpine } from './spine-limit';
import type { Vec2 } from './vector';

/**
 * 넘김 자세 = (잡은 점, 포인터)로 정해지는 한 순간의 상태. 좌표는 모델 좌표(book-frame.ts)다.
 *
 * 드래그 포인터와 클릭 넘김의 가상 포인터 모두 이 함수 하나를 거친다(tech-research.md 3장 "한 모델로").
 * 순서: 책등 제한 → 반사 접힘선 → 진행도. 같은 입력이면 같은 연산 순서로 같은 출력이 나온다.
 *
 * 잡은 점은 클릭이든 드래그든 projectToOuterEdge로 누른 점을 바깥 가장자리에 투영해 정한다.
 * 반사 접힘은 잡은 점이 쪽의 가장자리에 있을 때만 연속이다. 쪽 안쪽을 잡은 점으로 삼으면 포인터가 조금만
 * 움직여도 잡은 점 너머 전체가 한 번에 접히고, 진행도(progress.ts)도 잡은 위치마다 다른 모습을 가리킨다.
 */
export type TurnPose = {
  readonly grab: Vec2;
  /** 책등 제한을 거친 포인터. 접힌 뒤 잡은 점이 놓이는 위치다. */
  readonly pointer: Vec2;
  /** 포인터가 잡은 점과 같으면 null(접힘 없음). */
  readonly fold: FoldLine | null;
  /** progress.ts 정의의 진행도, [0, 1]. */
  readonly progress: number;
};

/**
 * 누른 점(클릭·드래그 공통)을 바깥 가장자리(x = 쪽 폭) 점으로 투영해 잡은 점으로 삼는다. y는 쪽 안으로 자른다.
 * 누른 점 자체는 입력 주인 판정(input-priority.ts)과 속도(velocity.ts)에만 쓴다.
 *
 * 드래그 시작 순간에는 바깥 가장자리가 포인터 아래로 오므로, 가장자리에서 포인터까지 거리의 절반 폭의 띠가
 * 한 번에 접힌다. 누른 점이 가장자리에서 멀수록 첫 프레임 접힘이 크다. 넘김 영역을 가장자리 띠로 좁힐지는
 * 넘김 영역 배치와 함께 사용자 G2 결정이다(input-priority.ts TurnRegion).
 */
export function projectToOuterEdge(press: Vec2, page: PageSize): Vec2 {
  return { x: page.width, y: Math.min(Math.max(press.y, 0), page.height) };
}

export function computeTurnPose(grab: Vec2, rawPointer: Vec2, page: PageSize): TurnPose {
  const pointer = limitPointerToSpine(rawPointer, grab, page);
  return {
    grab,
    pointer,
    fold: createFoldLine(grab, pointer),
    progress: turnProgress(grab, pointer),
  };
}
