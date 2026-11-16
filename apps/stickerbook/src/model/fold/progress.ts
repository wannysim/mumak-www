import type { Vec2 } from './vector';

/**
 * 넘김 진행도. 좌표는 모델 좌표(book-frame.ts)다.
 *
 * 정의: 진행도 = (G.x - P.x) / (2 · G.x), [0, 1]로 자른다.
 * 잡은 점 G가 책등 건너편 거울 위치 (-G.x, G.y)까지 가는 수평 이동 중 포인터 P가 지난 비율이다.
 *
 * - 0: P.x = G.x. 아직 넘기지 않았다.
 * - 0.5: P.x = 0. 포인터가 책등 위에 있다. 바깥 가장자리(G.x = 쪽 폭)를 잡았다면 "책등을 넘었는가"
 *   (StPageFlip의 완주 기준)와 "진행도 0.5"(@vysmo/flipbook `dragCommit`)가 같은 판정이 된다.
 * - 1: P.x = -G.x. 접힘선이 책등(x=0)과 겹쳐 장 전체가 넘어갔다.
 *
 * y는 진행도에 들어가지 않는다. 같은 수평 위치면 위아래로 기울여 잡아도 진행도가 같다.
 * spine-limit을 거친 포인터는 0 <= G.y <= 쪽 높이일 때 x∈[-G.x, G.x]에 머물러 자르기가 필요 없지만,
 * 제한 전 포인터를 넣어도 범위를 벗어나지 않도록 자른다.
 * 책등 위나 그 너머를 잡으면(G.x <= 0) 넘길 거리가 없으므로 0이다.
 */
export function turnProgress(grab: Vec2, pointer: Vec2): number {
  if (grab.x <= 0) {
    return 0;
  }
  return clampUnit((grab.x - pointer.x) / (2 * grab.x));
}

/** 진행도 → 포인터 x. turnProgress의 역함수(G.x > 0일 때). 클릭 넘김 경로와 착지 경로가 쓴다. */
export function pointerXForProgress(grabX: number, progress: number): number {
  return grabX * (1 - 2 * progress);
}

export function clampUnit(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}
