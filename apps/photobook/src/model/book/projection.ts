import type { Rect, Vec2 } from '@/model/fold';

import type { ClosedPlacement, OpenGeometry } from './geometry';
import type { Viewport } from './layout';
import type { Quat, Vec3 } from './quaternion';
import { applyMatrix3, quatToMatrix } from './quaternion';

/**
 * 닫힌 책의 화면 투영. 닫힌 책 컴포넌트가 CSS에 거는 것과 같은 변환을 순수 TS로 계산한다:
 *
 *   화면 점 = 원근(무대) · [상자 가운데 + 이동(offset) + 배율(scale) · R(자세) · 책 좌표 점]
 *
 * - 책 좌표는 책 상자 가운데가 원점이고 x 오른쪽, y 아래, z 앞표지 쪽이다. 꼭짓점은 (±W/2, ±H/2, ±D/2)다.
 * - 원근은 무대(.closed-stage, 화면 전체)의 CSS perspective와 perspective-origin이다. 이 파일이 값의 정본이고
 *   컴포넌트는 여기서 읽어 인라인으로 건다.
 * - 탭이 책 위인지는 8개 꼭짓점을 투영한 볼록 다각형 안인지로 가린다(2026-11-16 사용자 결정 B.4).
 */

/** 무대 원근 거리. 임시, open-decisions G0 "닫힌 책 형태"(시안 closed-a perspective 2400px). */
export const CLOSED_PERSPECTIVE_PX = 2400;

/** 카메라 위치(화면 비율). 책보다 조금 위에서 내려다본다. 임시, open-decisions G0 "닫힌 책 형태"(시안 50% 20%). */
const CLOSED_PERSPECTIVE_ORIGIN_RATIO: Vec2 = { x: 0.5, y: 0.2 };

/** 판정 영역 최소 크기(CSS px). WCAG 2.5.8, tech-research.md 7장 공통 규칙. */
const MIN_TARGET_PX = 24;

/** 원근 분모가 0 이하가 되지 않게 하는 하한(px). 책이 카메라 뒤로 가는 일은 없지만 계산을 막는다. */
const MIN_PERSPECTIVE_DEPTH_PX = 1;

export type Perspective = {
  readonly distance: number;
  /** 화면 좌표. */
  readonly origin: Vec2;
};

/** 닫힌 자리(travel 0)에서 펼친 쪽 자리(travel 1)까지 옮겨 가는 동안의 이동과 배율. 상자 가운데 기준. */
export type BookMotionFrame = {
  readonly offset: Vec3;
  readonly scale: number;
};

export function closedPerspective(viewport: Viewport): Perspective {
  return {
    distance: CLOSED_PERSPECTIVE_PX,
    origin: {
      x: viewport.width * CLOSED_PERSPECTIVE_ORIGIN_RATIO.x,
      y: viewport.height * CLOSED_PERSPECTIVE_ORIGIN_RATIO.y,
    },
  };
}

/**
 * 무대 원근 원점의 x를 책 좌표(book-local)로. 펼친 책은 화면 가로 가운데에 놓이므로(geometry.ts)
 * 화면 폭 = 책 왼쪽 여백 × 2 + 책 폭이다. 끌어 덮기가 판 끝을 손가락 아래에 두는 데 쓴다(closing.ts).
 */
export function perspectiveOriginInBook(open: OpenGeometry): number {
  const viewportWidth = 2 * open.book.x + open.book.width;
  return viewportWidth * CLOSED_PERSPECTIVE_ORIGIN_RATIO.x - open.book.x;
}

/**
 * travel 0이면 화면 가운데에 닫힌 책 크기로, 1이면 target 상자에 쪽 크기 그대로 둔다.
 * 펼친 쪽 자리에서는 정면을 보는 표지 면이 z = 0에 오도록 두께 절반만큼 뒤로 민다(원근 때문에 크기가 달라 보이지 않게).
 */
export function bookMotionFrame(placement: ClosedPlacement, travel: number): BookMotionFrame {
  const { target, center, scale, depth } = placement;
  return {
    offset: {
      x: (center.x - (target.x + target.width / 2)) * (1 - travel),
      y: (center.y - (target.y + target.height / 2)) * (1 - travel),
      z: (-depth / 2) * travel,
    },
    scale: scale + (1 - scale) * travel,
  };
}

export function bookCorners(placement: ClosedPlacement): Vec3[] {
  const halfWidth = placement.target.width / 2;
  const halfHeight = placement.target.height / 2;
  const halfDepth = placement.depth / 2;
  const corners: Vec3[] = [];
  for (const x of [-halfWidth, halfWidth]) {
    for (const y of [-halfHeight, halfHeight]) {
      for (const z of [-halfDepth, halfDepth]) {
        corners.push({ x, y, z });
      }
    }
  }
  return corners;
}

/** 책 좌표 점 → 무대 좌표(원근 전). x·y는 화면 px, z는 보는 사람 쪽이 +다. */
export function toStagePoint(point: Vec3, placement: ClosedPlacement, orientation: Quat, travel: number): Vec3 {
  const { offset, scale } = bookMotionFrame(placement, travel);
  const rotated = applyMatrix3(quatToMatrix(orientation), point);
  const { target } = placement;
  return {
    x: target.x + target.width / 2 + offset.x + scale * rotated.x,
    y: target.y + target.height / 2 + offset.y + scale * rotated.y,
    z: offset.z + scale * rotated.z,
  };
}

export function projectBookPoint(
  point: Vec3,
  placement: ClosedPlacement,
  orientation: Quat,
  travel: number,
  perspective: Perspective
): Vec2 {
  return projectStagePoint(toStagePoint(point, placement, orientation, travel), perspective);
}

/** 무대 좌표 점 → 화면 점(무대 CSS perspective). 책 밖의 점(예: 바닥에 떨어진 그림자)에도 쓴다. */
export function projectStagePoint(stage: Vec3, perspective: Perspective): Vec2 {
  const factor = perspective.distance / Math.max(perspective.distance - stage.z, MIN_PERSPECTIVE_DEPTH_PX);
  return {
    x: perspective.origin.x + (stage.x - perspective.origin.x) * factor,
    y: perspective.origin.y + (stage.y - perspective.origin.y) * factor,
  };
}

function cross(origin: Vec2, a: Vec2, b: Vec2): number {
  return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
}

/** 볼록 껍질(Andrew monotone chain). 한 직선 위의 점은 뺀다. 점이 셋 미만이거나 모두 한 직선 위면 남은 점 그대로다. */
export function convexHull(points: readonly Vec2[]): Vec2[] {
  const sorted = points.toSorted((a, b) => a.x - b.x || a.y - b.y);
  if (sorted.length < 3) {
    return sorted;
  }
  const lower: Vec2[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2) as Vec2, lower.at(-1) as Vec2, point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }
  const upper: Vec2[] = [];
  for (const point of sorted.toReversed()) {
    while (upper.length >= 2 && cross(upper.at(-2) as Vec2, upper.at(-1) as Vec2, point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** 볼록 다각형 안인가(경계 포함). 꼭짓점 순서 방향은 상관없다. 꼭짓점이 셋 미만이면 false. */
export function isPointInConvexPolygon(point: Vec2, polygon: readonly Vec2[]): boolean {
  if (polygon.length < 3) {
    return false;
  }
  let sign = 0;
  for (const [index, from] of polygon.entries()) {
    const to = polygon[(index + 1) % polygon.length] as Vec2;
    const side = cross(from, to, point);
    if (side === 0) {
      continue;
    }
    const current = Math.sign(side);
    if (sign !== 0 && current !== sign) {
      return false;
    }
    sign = current;
  }
  return true;
}

/** 회전된 책 8개 꼭짓점을 원근 투영한 볼록 다각형(화면 좌표). */
export function projectedBookOutline(
  viewport: Viewport,
  placement: ClosedPlacement,
  orientation: Quat,
  travel = 0
): Vec2[] {
  const perspective = closedPerspective(viewport);
  return convexHull(
    bookCorners(placement).map(corner => projectBookPoint(corner, placement, orientation, travel, perspective))
  );
}

/**
 * 닫힌 책 버튼 상자: 투영 다각형을 감싸는 사각형. 폭·높이는 24 CSS px 아래로 줄이지 않는다(WCAG 2.5.8).
 * 포인터 판정은 다각형으로 하고, 이 상자는 키보드 포커스 표시와 보조 기술이 가리킬 자리다(tech-research.md 7장).
 */
export function outlineBounds(outline: readonly Vec2[]): Rect {
  const xs = outline.map(point => point.x);
  const ys = outline.map(point => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const width = Math.max(...xs) - left;
  const height = Math.max(...ys) - top;
  const grownWidth = Math.max(width, MIN_TARGET_PX);
  const grownHeight = Math.max(height, MIN_TARGET_PX);
  return {
    x: left - (grownWidth - width) / 2,
    y: top - (grownHeight - height) / 2,
    width: grownWidth,
    height: grownHeight,
  };
}
