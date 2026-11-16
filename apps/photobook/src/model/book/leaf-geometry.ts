import type { BookFrame, FoldLine, PageSize, TurnDirection, Vec2 } from '@/model/fold';
import { reflectAcrossFold, splitPageByFold, toModelPoint, toScreenPoint } from '@/model/fold';

/**
 * 평면 DOM 접힘 렌더러의 기하(tech-research.md 3장 "평면 반사 접힘 (DOM)").
 * fold 모델의 반사 접힘으로 넘어가는 쪽을 평평한 부분과 접힌 부분으로 나누고, DOM 요소에 걸 clip-path 다각형과
 * CSS matrix를 계산한다. 좌표는 책 좌표(book-local, CSS px)다.
 *
 * 넘김에 나오는 두 요소:
 * - 윗장(upper): 넘어가는 장 중 지금 보이는 면. 원래 쪽 상자에 그대로 두고 평평한 부분만 남긴다.
 * - 날개(flap): 같은 장의 다른 면. 넘김이 끝나면 놓일 상자(책등 건너편)에 놓인 모습을 기준으로,
 *   접힘선 반사 변환으로 접힌 자리에 옮겨 그린다. 원점이 책 좌표 (0, 0)이고 transform-origin이 0 0인 요소에 건다.
 *
 * 날개 변환: 날개 면의 점 l(날개 면 기준 좌표)이 장 뒷면에서 가리키는 앞면의 점은 모델 좌표에서 q = 책등 거울(toModel(l + 날개 상자 원점))이다.
 * 그 점이 접힌 뒤 놓이는 곳은 reflect(q)다. 책등 거울과 접힘선 반사, 두 번의 반사라 결과는 회전 + 이동이며 글자가 뒤집히지 않는다.
 */
export type Affine = {
  /** x' = a·x + c·y + e, y' = b·x + d·y + f. CSS matrix(a, b, c, d, e, f)와 같은 순서다. */
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
};

export type LeafPlacement = {
  readonly frame: BookFrame;
  readonly direction: TurnDirection;
  /** 모델 쪽 크기(book-frame.ts toModelPageSize). */
  readonly page: PageSize;
};

export type LeafLayers = {
  /** 윗장 요소 기준 좌표의 clip 다각형. 비어 있으면 윗장이 모두 넘어갔다. */
  readonly upperClip: readonly Vec2[];
  /** 날개 요소 기준 좌표의 clip 다각형. 비어 있으면 아직 접힌 부분이 없다. */
  readonly flapClip: readonly Vec2[];
  /** 날개 요소 기준 좌표 → 책 좌표. */
  readonly flapTransform: Affine;
  /** 윗장 상자의 원점(책 좌표). */
  readonly upperOrigin: Vec2;
  /** 날개 면이 넘김 뒤 놓일 상자의 원점(책 좌표). */
  readonly flapRestOrigin: Vec2;
};

const PX_DIGITS = 3;
const MATRIX_DIGITS = 6;

/** 세 점의 상으로 아핀 변환을 정한다. map은 아핀이어야 한다. */
export function affineFromPointMap(map: (point: Vec2) => Vec2): Affine {
  const origin = map({ x: 0, y: 0 });
  const unitX = map({ x: 1, y: 0 });
  const unitY = map({ x: 0, y: 1 });
  return {
    a: unitX.x - origin.x,
    b: unitX.y - origin.y,
    c: unitY.x - origin.x,
    d: unitY.y - origin.y,
    e: origin.x,
    f: origin.y,
  };
}

export function applyAffine(matrix: Affine, point: Vec2): Vec2 {
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f,
  };
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function toCssMatrix(matrix: Affine): string {
  const linear = [matrix.a, matrix.b, matrix.c, matrix.d].map(value => round(value, MATRIX_DIGITS));
  const translation = [matrix.e, matrix.f].map(value => round(value, PX_DIGITS));
  return `matrix(${[...linear, ...translation].join(', ')})`;
}

/** 꼭짓점이 셋 미만이면 아무것도 보이지 않는 다각형을 돌려준다. */
export function toCssPolygon(points: readonly Vec2[]): string {
  if (points.length < 3) {
    return 'polygon(0px 0px, 0px 0px, 0px 0px)';
  }
  const coordinates = points.map(point => `${round(point.x, PX_DIGITS)}px ${round(point.y, PX_DIGITS)}px`);
  return `polygon(${coordinates.join(', ')})`;
}

function mirrorAcrossSpine(point: Vec2): Vec2 {
  return { x: -point.x, y: point.y };
}

function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

/** 모델 좌표 x∈[xMin, xMax], y∈[0, 쪽 높이] 사각형의 책 좌표 왼쪽 위. */
function modelRectOrigin(placement: LeafPlacement, xMin: number, xMax: number): Vec2 {
  const corners = [
    { x: xMin, y: 0 },
    { x: xMax, y: 0 },
    { x: xMax, y: placement.page.height },
    { x: xMin, y: placement.page.height },
  ].map(corner => toScreenPoint(corner, placement.frame, placement.direction));
  return {
    x: Math.min(...corners.map(corner => corner.x)),
    y: Math.min(...corners.map(corner => corner.y)),
  };
}

export function computeLeafLayers(placement: LeafPlacement, fold: FoldLine | null): LeafLayers {
  const { frame, direction, page } = placement;
  const upperOrigin = modelRectOrigin(placement, 0, page.width);
  const flapRestOrigin = modelRectOrigin(placement, -page.width, 0);
  const toUpperLocal = (modelPoint: Vec2) => subtract(toScreenPoint(modelPoint, frame, direction), upperOrigin);
  const toFlapLocal = (modelPoint: Vec2) =>
    subtract(toScreenPoint(mirrorAcrossSpine(modelPoint), frame, direction), flapRestOrigin);

  if (fold === null) {
    const corners = [
      { x: 0, y: 0 },
      { x: page.width, y: 0 },
      { x: page.width, y: page.height },
      { x: 0, y: page.height },
    ];
    return {
      upperClip: corners.map(toUpperLocal),
      flapClip: [],
      flapTransform: { a: 1, b: 0, c: 0, d: 1, e: flapRestOrigin.x, f: flapRestOrigin.y },
      upperOrigin,
      flapRestOrigin,
    };
  }

  const split = splitPageByFold(page, fold);
  const flapTransform = affineFromPointMap(local => {
    const frontPoint = mirrorAcrossSpine(toModelPoint(add(local, flapRestOrigin), frame, direction));
    return toScreenPoint(reflectAcrossFold(frontPoint, fold), frame, direction);
  });
  return {
    upperClip: split.flat.map(toUpperLocal),
    flapClip: split.folded.map(toFlapLocal),
    flapTransform,
    upperOrigin,
    flapRestOrigin,
  };
}
