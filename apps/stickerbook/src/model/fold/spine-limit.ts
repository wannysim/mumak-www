import type { PageSize } from './book-frame';
import type { Vec2 } from './vector';
import { addVec, distanceVec, lengthSquaredVec, scaleVec, subtractVec } from './vector';

/**
 * 책등 이탈 방지. 좌표는 모델 좌표(book-frame.ts)다.
 *
 * 종이는 책등에 붙어 있으므로 잡은 점 G가 갈 수 있는 곳은 책등 두 끝점에서 G까지의 거리를 넘지 못한다.
 * 그래서 포인터를 두 원(책등 위 끝점 중심 반경 |G - 위 끝점|, 책등 아래 끝점 중심 반경 |G - 아래 끝점|)의
 * 교집합 안으로 제한한다. Mantine Book `limitPointToCircle`과 같은 생각이며 코드는 가져오지 않았다.
 *
 * 이렇게 하면 두 끝점이 모두 G보다 포인터에 가깝거나 같으므로, 반사 접힘의 접힘선(GP 수직이등분선)이
 * 책등 선분을 가로지르지 않는다. 책등 전체가 평평한 쪽에 남는다.
 *
 * 두 원의 중심이 모두 x=0 위에 있고 둘 다 G를 지나므로, 두 원은 G와 그 거울점 (-G.x, G.y)에서 만난다.
 * 교집합(볼록한 렌즈)에 대한 가장 가까운 점은 (1) 포인터 자신 (2) 한 원에 대한 투영이 다른 원 안에 있으면
 * 그 투영 (3) 아니면 렌즈의 두 꼭짓점 G, 거울점 중 가까운 쪽이다.
 *
 * 부동소수 처리(엔지니어링 값, 손끝 감각과 무관):
 * - 책등 끝점의 접힘선 부호 거리는 (반경² - |P - 끝점|²) / (2·|P - G|)다. P가 원 밖으로 반올림 오차 η만큼만
 *   나가도 G 가까이에서는 |P - G|로 나뉘어 크게 음수가 된다(바깥으로 당긴 투영이 G에서 1e-14px 떨어진 곳에
 *   떨어지면 책등 전체가 접혔다). 그래서 판정과 투영을 반경보다 INNER_MARGIN_PX 작은 원으로 한다.
 *   그러면 결과는 실제 원 안쪽으로 INNER_MARGIN_PX - η(η는 1e-13px 수준) 이상 들어가 부호 거리가 양수로 남는다.
 * - 꼭짓점 G, 거울점은 그 줄인 원 밖이지만 그대로 돌려줘도 된다. G면 접힘이 없고(createFoldLine이 null),
 *   거울점이면 접힘선이 책등(x = 0) 자체라 끝점 부호 거리가 정확히 0이다.
 * - 결과가 꼭짓점에서 VERTEX_SNAP_PX 안이면 꼭짓점 자체를 돌려준다. 그 거리에서는 접힘선 방향이 입력의
 *   반올림 오차에 좌우되어, 보이지 않는 움직임에 큰 접힘이 생기거나 사라지기 때문이다.
 */

/** 판정·투영 원을 실제 반경보다 줄이는 폭(px). 반올림 오차(1e-13px 수준)의 수백 배, 좌표 1e4px까지 유효. */
const INNER_MARGIN_PX = 1e-10;

/** 꼭짓점에 붙이는 거리(px). 반올림 오차보다 훨씬 크고 화면에서 보이는 거리(1 기기 픽셀 = 0.3 CSS px 안팎)보다 훨씬 작다. */
const VERTEX_SNAP_PX = 1e-6;

/** isWithinSpineLimit 판정의 부동소수 여유(px). 원 위에 놓인 점이 반올림으로 경계를 살짝 넘는 경우를 받아 준다. */
const WITHIN_LIMIT_TOLERANCE_PX = 1e-9;

export type SpineEndpoints = {
  readonly top: Vec2;
  readonly bottom: Vec2;
};

export function spineEndpoints(page: PageSize): SpineEndpoints {
  return { top: { x: 0, y: 0 }, bottom: { x: 0, y: page.height } };
}

/**
 * 포인터를 책등 제한 렌즈 안으로 옮긴다. 이미 안이면 그대로 돌려준다(경계에서 INNER_MARGIN_PX 안쪽 띠의 점은
 * 그만큼 안으로 옮긴다). 결과가 렌즈 꼭짓점(G, 거울점)에서 VERTEX_SNAP_PX 안이면 꼭짓점 객체를 돌려준다
 * (G면 grab 그대로).
 */
export function limitPointerToSpine(pointer: Vec2, grab: Vec2, page: PageSize): Vec2 {
  const mirroredGrab = { x: -grab.x, y: grab.y };
  return snapToLensVertex(closestPointInLens(pointer, grab, mirroredGrab, page), grab, mirroredGrab);
}

/** 포인터가 제한 렌즈 안(경계 포함, 부동소수 여유 WITHIN_LIMIT_TOLERANCE_PX)에 있는가. */
export function isWithinSpineLimit(pointer: Vec2, grab: Vec2, page: PageSize): boolean {
  const { top, bottom } = spineEndpoints(page);
  return (
    distanceVec(pointer, top) <= distanceVec(grab, top) + WITHIN_LIMIT_TOLERANCE_PX &&
    distanceVec(pointer, bottom) <= distanceVec(grab, bottom) + WITHIN_LIMIT_TOLERANCE_PX
  );
}

function closestPointInLens(pointer: Vec2, grab: Vec2, mirroredGrab: Vec2, page: PageSize): Vec2 {
  const { top, bottom } = spineEndpoints(page);
  const topRadius = Math.max(distanceVec(grab, top) - INNER_MARGIN_PX, 0);
  const bottomRadius = Math.max(distanceVec(grab, bottom) - INNER_MARGIN_PX, 0);

  if (isInsideDisk(pointer, top, topRadius) && isInsideDisk(pointer, bottom, bottomRadius)) {
    return pointer;
  }
  const projectedToTop = projectToDisk(pointer, top, topRadius);
  if (isInsideDisk(projectedToTop, bottom, bottomRadius)) {
    return projectedToTop;
  }
  const projectedToBottom = projectToDisk(pointer, bottom, bottomRadius);
  if (isInsideDisk(projectedToBottom, top, topRadius)) {
    return projectedToBottom;
  }
  // 두 투영이 모두 다른 원 밖이면 가장 가까운 점은 렌즈 꼭짓점이다. 줄인 원의 교점 대신 실제 꼭짓점을 돌려준다.
  return distanceVec(pointer, grab) <= distanceVec(pointer, mirroredGrab) ? grab : mirroredGrab;
}

function snapToLensVertex(point: Vec2, grab: Vec2, mirroredGrab: Vec2): Vec2 {
  if (distanceVec(point, grab) <= VERTEX_SNAP_PX) {
    return grab;
  }
  if (distanceVec(point, mirroredGrab) <= VERTEX_SNAP_PX) {
    return mirroredGrab;
  }
  return point;
}

function isInsideDisk(point: Vec2, center: Vec2, radius: number): boolean {
  return distanceVec(point, center) <= radius;
}

function projectToDisk(point: Vec2, center: Vec2, radius: number): Vec2 {
  const offset = subtractVec(point, center);
  const distanceSquared = lengthSquaredVec(offset);
  if (distanceSquared <= radius * radius) {
    return point;
  }
  return addVec(center, scaleVec(offset, radius / Math.sqrt(distanceSquared)));
}
