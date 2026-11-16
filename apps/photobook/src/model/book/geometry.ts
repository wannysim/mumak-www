import type { BookFrame, BookView, PageLayout, PageSize, Rect, TurnDirection, Vec2 } from '@/model/fold';
import { spreadOfPage, spreadPages } from '@/model/fold';

import type { Viewport } from './layout';
import { rootFontPx } from './layout';
import type { CoverSide } from './rotation';

/**
 * 화면 크기 → 책의 화면 배치(CSS px). 렌더러와 넘김 모델이 같은 숫자를 쓰도록 CSS calc 대신 여기서 계산한다.
 * 좌표는 뷰포트 기준(스크롤 없음)이고, "책 좌표(book-local)"는 책 상자의 왼쪽 위가 원점이다.
 * 모든 치수는 임시값이며 mockups/still의 정지 화면 시안(spread-a, phone-a, closed-a) 공식을 옮겼다.
 * rem은 화면에서 읽은 루트 글자 크기다(layout.ts rootFontPx, 정본은 src/index.css).
 */

/** 쪽 판형 폭:높이. 임시, open-decisions G0 "책 안 화면 구성과 펼침면 비율"(시안 3:4). */
export const PAGE_ASPECT = 0.75;

/**
 * 펼침면 양옆에 남길 폭(한쪽) = min(6rem, max(2.5rem, 화면 폭 × 6%)). 넘김 버튼 기둥과 화살표가 놓인다.
 * 임시, open-decisions G0 "책 크기와 모바일 주소창"(시안 spread-a의 100vw - 12rem). 세로 태블릿·좁은 창에서
 * 6rem 고정이면 펼침면이 너무 작아져(768×1024에서 화면 높이의 37%) 화면 폭 비율로 줄인다.
 */
const SPREAD_SIDE_RESERVE_REM = 6;
const SPREAD_SIDE_RESERVE_MIN_REM = 2.5;
const SPREAD_SIDE_RESERVE_VIEWPORT_RATIO = 0.06;
/** 펼침면 위아래에 남길 폭(rem, 합계). 임시, G0 "책 크기", 시안 spread-a의 (100svh - 14rem). */
const SPREAD_VERTICAL_RESERVE_REM = 14;
/** 위아래 여백이 화면 높이의 이 비율을 넘지 않게 한다(가로 휴대폰처럼 낮은 화면). 임시, G0 "책 크기". */
const SPREAD_VERTICAL_RESERVE_MAX_RATIO = 0.25;

/**
 * 책 윗변이 내려올 최소 거리(rem). 러닝 헤드(py-4 위아래 + 줄 높이 1.4 = 3.4rem)가 책을 덮지 않게 한다.
 * 임시, open-decisions G0 "책 크기"·G4 "러닝 헤드"(러닝 헤드는 책 바깥 위 한 줄, 확정).
 */
export const RUNNING_HEAD_CLEARANCE_REM = 3.5;

/**
 * 세로 휴대폰 한 쪽의 좌우 여백(rem, 한쪽). 임시, G0 "책 크기".
 * 시안 phone-a(0.75rem)보다 넓다. 화면 가장자리와 책 사이에 여백을 둔다(tech-research.md 0장 입력 통일).
 */
const SINGLE_SIDE_GUTTER_REM = 1.25;
/** 세로 휴대폰 아래 여백(rem). 위는 RUNNING_HEAD_CLEARANCE_REM. 임시, G0 "책 크기". */
const SINGLE_BOTTOM_RESERVE_REM = 1.5;

/**
 * 넘김 버튼 기둥이 쪽 바깥 가장자리 안으로 들어오는 폭(쪽 폭 비율). 임시, open-decisions G2 "클릭 넘김 영역의 배치와 표시".
 * 클릭 기둥은 화면 가장자리부터 이 띠까지다. 펼침면의 드래그 시작 영역도 이 띠까지다.
 */
export const TURN_EDGE_BAND_RATIO = 0.12;

/**
 * 드래그 넘김을 시작하지 않는 화면 가장자리 폭(CSS px). 클릭 기둥은 화면 끝까지 그대로 두고 드래그 시작만 막는다.
 * iOS Safari 가장자리 스와이프 뒤로가기와 겹치지 않게 하려는 값이다(tech-research.md 0장, 실기기 확인 전).
 * 임시, open-decisions G2 "클릭 넘김 영역의 배치와 표시".
 */
export const SCREEN_EDGE_DRAG_GUARD_PX = 24;

/** 책 두께 = 쪽 폭의 비율. 임시, open-decisions G0 "닫힌 책 형태·재질"(시안 closed-a 5%). */
export const BOOK_DEPTH_RATIO = 0.05;

/** 닫힌 책 높이 = min(화면 높이 × a, 화면 폭 × b). 임시, G0 "닫힌 책 형태", 시안 closed-a의 min(58svh, 62vw). */
const CLOSED_BOOK_HEIGHT_OF_VIEWPORT_HEIGHT = 0.58;
const CLOSED_BOOK_HEIGHT_OF_VIEWPORT_WIDTH = 0.62;

/** 계산이 0이나 음수가 되는 아주 작은 화면에서도 쪽 크기를 양수로 둔다. */
const MIN_PAGE_HEIGHT_PX = 1;

export type OpenGeometry = {
  readonly layout: PageLayout;
  /** 한 쪽의 화면 크기. */
  readonly page: PageSize;
  /** 'spread'면 두 쪽(2W × H), 'single'이면 한 쪽(W × H). 뷰포트 좌표. */
  readonly book: Rect;
  /** 넘김 버튼 기둥(클릭 판정, 뷰포트 좌표). backward는 왼쪽, forward는 오른쪽. 화면 가장자리부터 쪽 바깥 띠까지. */
  readonly turnZones: Readonly<Record<TurnDirection, Rect>>;
  /**
   * 드래그 넘김을 시작할 수 있는 영역(뷰포트 좌표). 화면 가장자리 SCREEN_EDGE_DRAG_GUARD_PX는 뺀다.
   * 'spread'는 클릭 기둥과 같은 띠, 'single'은 쪽 전체(왼쪽 절반은 이전 쪽, 오른쪽 절반은 다음 쪽).
   * 세로 휴대폰 배치는 임시, open-decisions G2 "클릭 넘김 영역의 배치와 표시".
   */
  readonly dragZones: Readonly<Record<TurnDirection, Rect>>;
};

export type ClosedPlacement = {
  /** 3D 책을 쪽 크기로 놓는 상자(뷰포트 좌표). 펼친 뒤 앞표지 아래 쪽이 놓일 자리와 같다. */
  readonly target: Rect;
  /** 닫힌 책 중심(뷰포트 좌표). */
  readonly center: Vec2;
  /** 쪽 크기 대비 닫힌 책 크기. */
  readonly scale: number;
  /** 닫힌 책을 정면에서 본 상자(뷰포트 좌표). */
  readonly frontBox: Rect;
  /** 닫힌 책 두께(3D 책 단위, 즉 쪽 크기 기준 CSS px). */
  readonly depth: number;
};

function spanRect(left: number, right: number, y: number, height: number): Rect {
  return { x: left, y, width: Math.max(right - left, 0), height };
}

function turnZonesFor(viewport: Viewport, book: Rect, pageWidth: number): Record<TurnDirection, Rect> {
  const band = pageWidth * TURN_EDGE_BAND_RATIO;
  return {
    backward: spanRect(0, book.x + band, book.y, book.height),
    forward: spanRect(book.x + book.width - band, viewport.width, book.y, book.height),
  };
}

function dragZonesFor(
  viewport: Viewport,
  book: Rect,
  pageWidth: number,
  layout: PageLayout
): Record<TurnDirection, Rect> {
  const left = SCREEN_EDGE_DRAG_GUARD_PX;
  const right = viewport.width - SCREEN_EDGE_DRAG_GUARD_PX;
  const bookRight = book.x + book.width;
  if (layout === 'single') {
    const middle = book.x + book.width / 2;
    return {
      backward: spanRect(Math.max(book.x, left), middle, book.y, book.height),
      forward: spanRect(middle, Math.min(bookRight, right), book.y, book.height),
    };
  }
  const band = pageWidth * TURN_EDGE_BAND_RATIO;
  return {
    backward: spanRect(left, book.x + band, book.y, book.height),
    forward: spanRect(bookRight - band, right, book.y, book.height),
  };
}

function withZones(viewport: Viewport, layout: PageLayout, page: PageSize, book: Rect): OpenGeometry {
  return {
    layout,
    page,
    book,
    turnZones: turnZonesFor(viewport, book, page.width),
    dragZones: dragZonesFor(viewport, book, page.width, layout),
  };
}

function spreadGeometry(viewport: Viewport): OpenGeometry {
  const rem = rootFontPx(viewport);
  const sideReserve = Math.min(
    SPREAD_SIDE_RESERVE_REM * rem,
    Math.max(SPREAD_SIDE_RESERVE_MIN_REM * rem, viewport.width * SPREAD_SIDE_RESERVE_VIEWPORT_RATIO)
  );
  const verticalReserve = Math.min(
    SPREAD_VERTICAL_RESERVE_REM * rem,
    viewport.height * SPREAD_VERTICAL_RESERVE_MAX_RATIO
  );
  const top = Math.max(verticalReserve / 2, RUNNING_HEAD_CLEARANCE_REM * rem);
  const available = viewport.height - top - verticalReserve / 2;
  const maxSpreadWidth = viewport.width - 2 * sideReserve;
  const height = Math.max(Math.min(available, maxSpreadWidth / (2 * PAGE_ASPECT)), MIN_PAGE_HEIGHT_PX);
  const width = height * PAGE_ASPECT;
  const book = {
    x: (viewport.width - 2 * width) / 2,
    y: top + (available - height) / 2,
    width: 2 * width,
    height,
  };
  return withZones(viewport, 'spread', { width, height }, book);
}

function singleGeometry(viewport: Viewport): OpenGeometry {
  const rem = rootFontPx(viewport);
  const top = RUNNING_HEAD_CLEARANCE_REM * rem;
  const available = viewport.height - top - SINGLE_BOTTOM_RESERVE_REM * rem;
  const width = Math.max(
    Math.min(viewport.width - 2 * SINGLE_SIDE_GUTTER_REM * rem, available * PAGE_ASPECT),
    MIN_PAGE_HEIGHT_PX * PAGE_ASPECT
  );
  const height = width / PAGE_ASPECT;
  const book = {
    x: (viewport.width - width) / 2,
    y: top + Math.max((available - height) / 2, 0),
    width,
    height,
  };
  return withZones(viewport, 'single', { width, height }, book);
}

export function computeOpenGeometry(viewport: Viewport, layout: PageLayout): OpenGeometry {
  return layout === 'spread' ? spreadGeometry(viewport) : singleGeometry(viewport);
}

/** 펼침이 시작되는 책 몸 자리: 펼침면이면 오른쪽 쪽, 한 쪽 배치면 그 쪽 상자(펼친 뒤 2쪽이 놓이는 곳). */
function openingBody(open: OpenGeometry): Rect {
  const { page, book } = open;
  return open.layout === 'spread'
    ? { x: book.x + page.width, y: book.y, width: page.width, height: page.height }
    : book;
}

/**
 * 닫힌 책 배치. 3D 책은 펼친 뒤의 쪽 크기로 그리고 scale로 줄여 둔다.
 * 그래서 펼침이 끝날 때 표지 안쪽과 그 아래 쪽이 변환 없는 DOM 쪽과 같은 크기·같은 줄바꿈으로 착지한다.
 * target은 펼친 쪽 자리에서 책 몸(표지가 덮이는 쪽)이 놓이는 상자다. 기본은 펼침이 시작되는 자리이고, 덮을 때는 coverLayout의 body다.
 */
export function computeClosedPlacement(
  viewport: Viewport,
  open: OpenGeometry,
  target: Rect = openingBody(open)
): ClosedPlacement {
  const { page } = open;
  const closedHeight = Math.min(
    viewport.height * CLOSED_BOOK_HEIGHT_OF_VIEWPORT_HEIGHT,
    viewport.width * CLOSED_BOOK_HEIGHT_OF_VIEWPORT_WIDTH
  );
  const scale = closedHeight / page.height;
  const center = { x: viewport.width / 2, y: viewport.height / 2 };
  const frontWidth = page.width * scale;
  return {
    target,
    center,
    scale,
    frontBox: {
      x: center.x - frontWidth / 2,
      y: center.y - closedHeight / 2,
      width: frontWidth,
      height: closedHeight,
    },
    depth: target.width * BOOK_DEPTH_RATIO,
  };
}

/**
 * 표지를 여닫는 동안 3D 책이 보여 줄 쪽과 자리. 화면 view의 펼침을 기준으로 한다(가운데 펼침에서 덮어도 같은 규칙).
 * - 앞표지: 왼쪽 쪽(과 그 앞 장들)이 표지와 함께 넘어와 오른쪽 쪽을 덮는다. 판 안쪽은 왼쪽 쪽, 덮이는 쪽은 오른쪽 쪽.
 * - 뒤표지: 오른쪽 쪽이 뒤표지와 함께 넘어와 왼쪽 쪽을 덮는다. 판 안쪽은 오른쪽 쪽, 덮이는 쪽은 왼쪽 쪽.
 * 책 몸(body)은 덮이는 쪽 자리다. 한 쪽 배치에서 화면에 보이는 쪽이 판 안쪽이면(예: 1쪽에서 앞표지로 덮기) 책 몸은 화면 밖
 * 책등 건너편(앞표지는 오른쪽, 뒤표지는 왼쪽)에 있고, 판이 화면의 쪽 상자를 채운다.
 * 펼침은 앞표지·첫 화면(펼침 0 또는 2쪽)으로 이 규칙과 같은 자리·같은 쪽(1쪽 안쪽, 2쪽 아래)이 된다.
 */
export type CoverLayout = {
  readonly inside: number;
  readonly under: number;
  readonly body: Rect;
};

export function coverLayout(open: OpenGeometry, side: CoverSide, view: BookView): CoverLayout {
  const firstPage = view.layout === 'spread' ? spreadPages(view.spread).left : view.page;
  const { left, right } = spreadPages(spreadOfPage(firstPage));
  const inside = side === 'front' ? left : right;
  const under = side === 'front' ? right : left;
  const { book, page } = open;
  const boxAt = (x: number): Rect => ({ x, y: book.y, width: page.width, height: page.height });
  if (open.layout === 'spread') {
    return { inside, under, body: boxAt(side === 'front' ? book.x + page.width : book.x) };
  }
  const shift = firstPage === under ? 0 : side === 'front' ? page.width : -page.width;
  return { inside, under, body: boxAt(book.x + shift) };
}

/** 책 좌표의 쪽 상자. 'spread'는 [왼쪽, 오른쪽], 'single'은 [그 쪽]. */
export function pageBoxes(open: OpenGeometry): Rect[] {
  const { width, height } = open.page;
  if (open.layout === 'spread') {
    return [
      { x: 0, y: 0, width, height },
      { x: width, y: 0, width, height },
    ];
  }
  return [{ x: 0, y: 0, width, height }];
}

/**
 * 넘김 모델 프레임(책 좌표). 'spread'는 가운데 책등.
 * 'single'은 보이는 한 쪽을 오른쪽 쪽처럼 접는다: 앞으로는 왼쪽 가장자리, 뒤로는 오른쪽 가장자리를 책등으로 삼는다.
 * 뒤로 넘김의 거울 배치는 임시, open-decisions G0 "세로 휴대폰 배치"(장을 넘기지 않는 이동의 표현은 미정, pages.ts).
 */
export function turnFrame(open: OpenGeometry, direction: TurnDirection): BookFrame {
  const { width } = open.page;
  if (open.layout === 'spread') {
    return { spineAxis: 'vertical', spineOrigin: { x: width, y: 0 } };
  }
  return { spineAxis: 'vertical', spineOrigin: { x: direction === 'forward' ? 0 : width, y: 0 } };
}

/** 뷰포트 좌표 → 책 좌표. */
export function toBookLocal(point: Vec2, open: OpenGeometry): Vec2 {
  return { x: point.x - open.book.x, y: point.y - open.book.y };
}

export function isSamePageSize(a: PageSize, b: PageSize): boolean {
  return a.width === b.width && a.height === b.height;
}
