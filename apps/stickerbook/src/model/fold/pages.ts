/**
 * 쪽 번호와 장(leaf) 매핑.
 *
 * - 쪽 번호는 1부터. 펼침 s(0부터)의 왼쪽은 2s+1쪽, 오른쪽은 2s+2쪽이다. 펼침 0은 1·2쪽이다.
 * - 장 L(0부터)은 앞면 2L+2쪽, 뒷면 2L+3쪽이다. 펼침 s에서 앞으로 넘기면 장 s가 넘어간다:
 *   오른쪽 2s+2쪽이 들려 뒷면 2s+3쪽이 다음 펼침의 왼쪽이 되고, 아래에서 2s+4쪽이 드러난다.
 *   plan.md 예: 02쪽 뒷면은 03쪽이며 아래에서 04쪽이 드러난다.
 * - 1쪽(첫 펼침 왼쪽)과 마지막 쪽(마지막 펼침 오른쪽)은 넘길 장에 속하지 않는다. 그래서 총 쪽 수는
 *   2 이상의 짝수이고, 넘길 수 있는 장은 펼침 수 - 1개다. 각 쪽에 무엇을 둘지(쪽 지도)는 사용자 G0 결정이다.
 * - pageCount를 받는 함수는 쪽(1 이상 pageCount 이하 정수)과 펼침(0 이상 펼침 수 - 1 이하 정수)이 책 안에 있는지
 *   확인하고, 밖이면 RangeError를 던진다. 없는 장을 조용히 만들지 않기 위해서다. pageCount를 받지 않는
 *   spreadPages·leafPages·spreadOfPage·visiblePages·viewOfPage는 번호 계산만 하고 범위를 보지 않는다.
 *
 * 배치(PageLayout):
 * - 'spread': 좌우 두 쪽을 함께 본다. 다음·이전은 장 하나를 넘긴다.
 * - 'single': 한 쪽씩 본다. 세로 휴대폰 배치다(2026-11-13 사용자 결정, plan.md 화면 대응).
 *   오른쪽 쪽(짝수)에서 다음으로 가면 그 장을 넘기고, 왼쪽 쪽(홀수)에서 다음으로 가면 같은 펼침 안
 *   오른쪽으로 옮길 뿐 장을 넘기지 않는다. 이전은 그 반대다.
 *   장을 넘기지 않는 이동을 어떻게 보여 줄지는 디자인 결정이며 여기서 정하지 않는다.
 */
export type PageLayout = 'spread' | 'single';

export type BookView =
  | { readonly layout: 'spread'; readonly spread: number }
  | { readonly layout: 'single'; readonly page: number };

export type SpreadPages = {
  readonly left: number;
  readonly right: number;
};

export type LeafTurn = {
  readonly leaf: number;
  /** 'forward'는 오른쪽 쪽이 왼쪽으로, 'backward'는 왼쪽 쪽이 오른쪽으로 넘어간다. */
  readonly direction: 'forward' | 'backward';
  readonly frontPage: number;
  readonly backPage: number;
  /** 넘어가는 장 아래에서 드러나는 쪽. */
  readonly revealedPage: number;
};

export type ViewMove = {
  readonly view: BookView;
  /** 장을 넘기지 않고 같은 펼침 안에서 옮기면 null('single' 배치에서만 생긴다). */
  readonly turn: LeafTurn | null;
};

export function assertPageCount(pageCount: number): void {
  if (!Number.isInteger(pageCount) || pageCount < 2 || pageCount % 2 !== 0) {
    throw new RangeError(`pageCount는 2 이상의 짝수여야 한다: ${pageCount}`);
  }
}

export function spreadCount(pageCount: number): number {
  assertPageCount(pageCount);
  return pageCount / 2;
}

function assertPageInBook(page: number, pageCount: number): void {
  assertPageCount(pageCount);
  if (!Number.isInteger(page) || page < 1 || page > pageCount) {
    throw new RangeError(`쪽은 1 이상 ${pageCount} 이하 정수여야 한다: ${page}`);
  }
}

function assertSpreadInBook(spread: number, pageCount: number): void {
  const lastSpread = spreadCount(pageCount) - 1;
  if (!Number.isInteger(spread) || spread < 0 || spread > lastSpread) {
    throw new RangeError(`펼침은 0 이상 ${lastSpread} 이하 정수여야 한다: ${spread}`);
  }
}

function assertViewInBook(view: BookView, pageCount: number): void {
  if (view.layout === 'spread') {
    assertSpreadInBook(view.spread, pageCount);
  } else {
    assertPageInBook(view.page, pageCount);
  }
}

export function spreadPages(spread: number): SpreadPages {
  return { left: 2 * spread + 1, right: 2 * spread + 2 };
}

export function spreadOfPage(page: number): number {
  return Math.floor((page - 1) / 2);
}

export function leafPages(leaf: number): { readonly front: number; readonly back: number } {
  return { front: 2 * leaf + 2, back: 2 * leaf + 3 };
}

/** 쪽이 속한 장과 면. 1쪽과 마지막 쪽은 넘길 장에 속하지 않아 null이다. */
export function leafOfPage(
  page: number,
  pageCount: number
): { readonly leaf: number; readonly side: 'front' | 'back' } | null {
  assertPageInBook(page, pageCount);
  if (page === 1 || page === pageCount) {
    return null;
  }
  if (page % 2 === 0) {
    return { leaf: (page - 2) / 2, side: 'front' };
  }
  return { leaf: (page - 3) / 2, side: 'back' };
}

/** 펼침 s에서 앞으로 넘길 때 넘어가는 장. 마지막 펼침이면 null. */
export function forwardTurnFromSpread(spread: number, pageCount: number): LeafTurn | null {
  assertSpreadInBook(spread, pageCount);
  if (spread === spreadCount(pageCount) - 1) {
    return null;
  }
  const { front, back } = leafPages(spread);
  return { leaf: spread, direction: 'forward', frontPage: front, backPage: back, revealedPage: back + 1 };
}

/** 펼침 s에서 뒤로 넘길 때 넘어가는 장. 첫 펼침이면 null. */
export function backwardTurnFromSpread(spread: number, pageCount: number): LeafTurn | null {
  assertSpreadInBook(spread, pageCount);
  if (spread === 0) {
    return null;
  }
  const { front, back } = leafPages(spread - 1);
  return { leaf: spread - 1, direction: 'backward', frontPage: front, backPage: back, revealedPage: front - 1 };
}

/** 지금 보이는 쪽 번호. 'spread'는 [왼쪽, 오른쪽], 'single'은 [그 쪽]. */
export function visiblePages(view: BookView): number[] {
  if (view.layout === 'spread') {
    const { left, right } = spreadPages(view.spread);
    return [left, right];
  }
  return [view.page];
}

/** 배치를 바꿀 때 쓰는, 그 쪽이 보이는 화면. 'spread'면 그 쪽이 든 펼침이다. */
export function viewOfPage(page: number, layout: PageLayout): BookView {
  if (layout === 'spread') {
    return { layout, spread: spreadOfPage(page) };
  }
  return { layout, page };
}

/** 다음 화면. 끝이면 null. */
export function nextView(view: BookView, pageCount: number): ViewMove | null {
  assertViewInBook(view, pageCount);
  if (view.layout === 'spread') {
    const turn = forwardTurnFromSpread(view.spread, pageCount);
    return turn === null ? null : { view: { layout: 'spread', spread: view.spread + 1 }, turn };
  }
  if (view.page === pageCount) {
    return null;
  }
  const isRightPage = view.page % 2 === 0;
  return {
    view: { layout: 'single', page: view.page + 1 },
    turn: isRightPage ? forwardTurnFromSpread(spreadOfPage(view.page), pageCount) : null,
  };
}

/** 이전 화면. 처음이면 null. */
export function previousView(view: BookView, pageCount: number): ViewMove | null {
  assertViewInBook(view, pageCount);
  if (view.layout === 'spread') {
    const turn = backwardTurnFromSpread(view.spread, pageCount);
    return turn === null ? null : { view: { layout: 'spread', spread: view.spread - 1 }, turn };
  }
  if (view.page === 1) {
    return null;
  }
  const isLeftPage = view.page % 2 === 1;
  return {
    view: { layout: 'single', page: view.page - 1 },
    turn: isLeftPage ? backwardTurnFromSpread(spreadOfPage(view.page), pageCount) : null,
  };
}
