import type { PageSize } from './book-frame';
import type { Vec2 } from './vector';
import { dotVec, lerpVec, normalizeVec, scaleVec, subtractVec } from './vector';

/**
 * 반사 접힘 (평면). 좌표는 모델 좌표(book-frame.ts)다.
 *
 * 잡은 점 G가 포인터 P로 옮겨지도록 종이를 접으면 접힘선은 선분 GP의 수직이등분선이다.
 * 모서리를 잡든 가장자리 가운데를 잡든 같은 식 하나로 처리한다(tech-research.md 3장 반사 접힘).
 *
 * 부호 규칙: signedDistance(Q) = dot(Q - midpoint, normal), normal = (P - G) / |P - G|.
 * - G 쪽(signedDistance < 0)이 접혀 넘어가는 영역이다.
 * - P 쪽(signedDistance >= 0)은 평평하게 남는다. 책등은 spine-limit으로 이 쪽에 남는다.
 */
export type FoldLine = {
  /** 선분 GP의 중점. 접힘선 위의 점이다. */
  readonly midpoint: Vec2;
  /** G에서 P를 향하는 단위 벡터. 접힘선의 법선이다. */
  readonly normal: Vec2;
};

export type PageSplit = {
  /** 평평하게 남는 영역의 다각형(원래 위치, 꼭짓점 순서는 pageCorners를 따른다). 비어 있을 수 있다. */
  readonly flat: readonly Vec2[];
  /** 접혀 넘어가는 영역의 다각형(접히기 전 원래 위치). 비어 있을 수 있다. */
  readonly folded: readonly Vec2[];
};

/** G와 P가 같은 점이면 접힘이 없으므로 null이다. */
export function createFoldLine(grab: Vec2, pointer: Vec2): FoldLine | null {
  const normal = normalizeVec(subtractVec(pointer, grab));
  if (normal === null) {
    return null;
  }
  return { midpoint: lerpVec(grab, pointer, 0.5), normal };
}

export function signedDistanceToFold(point: Vec2, fold: FoldLine): number {
  return dotVec(subtractVec(point, fold.midpoint), fold.normal);
}

/** 접혀 넘어가는 쪽(G 쪽)에 있는가. 접힘선 위의 점은 접히지 않은 것으로 본다. */
export function isFoldedPoint(point: Vec2, fold: FoldLine): boolean {
  return signedDistanceToFold(point, fold) < 0;
}

/** 접힘선에 대한 거울 반사. 접힌 영역의 점이 접힌 뒤 놓이는 위치다. */
export function reflectAcrossFold(point: Vec2, fold: FoldLine): Vec2 {
  const distance = signedDistanceToFold(point, fold);
  return subtractVec(point, scaleVec(fold.normal, 2 * distance));
}

export function reflectPolygonAcrossFold(polygon: readonly Vec2[], fold: FoldLine): Vec2[] {
  return polygon.map(point => reflectAcrossFold(point, fold));
}

/** 쪽 사각형의 꼭짓점. 책등 위 → 바깥 위 → 바깥 아래 → 책등 아래 순서다. */
export function pageCorners(page: PageSize): Vec2[] {
  return [
    { x: 0, y: 0 },
    { x: page.width, y: 0 },
    { x: page.width, y: page.height },
    { x: 0, y: page.height },
  ];
}

/**
 * 쪽 사각형을 접힘선으로 나눈다(Sutherland–Hodgman, 반평면 하나).
 * 평면 DOM 접힘 기준선에서는 flat을 아래 쪽의 clip-path로, folded를 반사해 넘어가는 장의 뒷면으로 쓴다.
 * 접힘선 위의 꼭짓점은 두 다각형에 모두 들어간다.
 */
export function splitPageByFold(page: PageSize, fold: FoldLine): PageSplit {
  const corners = pageCorners(page);
  return {
    flat: clipPolygonByFold(corners, fold, 'flat'),
    folded: clipPolygonByFold(corners, fold, 'folded'),
  };
}

function clipPolygonByFold(polygon: readonly Vec2[], fold: FoldLine, keep: 'flat' | 'folded'): Vec2[] {
  const isKept = (distance: number) => (keep === 'flat' ? distance >= 0 : distance <= 0);
  const clipped: Vec2[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index] as Vec2;
    const end = polygon[(index + 1) % polygon.length] as Vec2;
    const startDistance = signedDistanceToFold(start, fold);
    const endDistance = signedDistanceToFold(end, fold);
    if (isKept(startDistance)) {
      clipped.push(start);
    }
    const crossesLine = (startDistance < 0 && endDistance > 0) || (startDistance > 0 && endDistance < 0);
    if (crossesLine) {
      clipped.push(lerpVec(start, end, startDistance / (startDistance - endDistance)));
    }
  }
  return clipped;
}

/** 단순 다각형의 넓이(신발끈 공식, 절댓값). */
export function polygonArea(polygon: readonly Vec2[]): number {
  let twiceSignedArea = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index] as Vec2;
    const next = polygon[(index + 1) % polygon.length] as Vec2;
    twiceSignedArea += current.x * next.y - next.x * current.y;
  }
  return Math.abs(twiceSignedArea) / 2;
}
