import type { PageLayout } from '@/model/fold';

/**
 * 화면 크기 → 펼침 배치. 'single'은 세로 휴대폰 한 쪽씩 보기(2026-11-13 사용자 결정, plan.md 화면 대응),
 * 나머지(데스크톱·태블릿·가로 휴대폰)는 좌우 두 쪽 'spread'다.
 * 판정은 CSS px 화면 크기만 보고 기기 종류를 추측하지 않는다(tech-research.md 0장 "레이아웃 적응").
 */
export type Viewport = {
  readonly width: number;
  readonly height: number;
  /**
   * 루트 글자 크기(CSS px). 화면에서 읽은 값(src/index.css :root)이고, 없으면 브라우저 기본값 16px로 본다.
   * rem 치수를 CSS와 같은 값으로 계산하려고 받는다(CSS가 정본이다).
   */
  readonly rootFontPx?: number;
};

/** 브라우저 기본 글자 크기. 화면에서 루트 글자 크기를 읽지 못했을 때 쓴다. */
const DEFAULT_ROOT_FONT_PX = 16;

/** 한 쪽씩 보는 최대 화면 폭(CSS px). 임시, open-decisions G0 "책 안 화면 구성과 펼침면 비율". */
export const SINGLE_LAYOUT_MAX_WIDTH_PX = 600;

/** 한 쪽씩 보려면 세로가 가로의 몇 배 이상이어야 하는지. 임시, open-decisions G0 "책 안 화면 구성과 펼침면 비율". */
const SINGLE_LAYOUT_MIN_ASPECT = 1.2;

/**
 * 러닝 헤드의 "지금 상태 한 줄"을 보이는 최소 화면 폭(rem). 이보다 좁으면 한 줄에 들지 않아 숨긴다(세로 휴대폰처럼).
 * 임시, open-decisions G4 "러닝 헤드 항목·문구"(시안 문구 기준 약 15rem + 쪽 번호 + 이름 줄).
 */
export const RUNNING_HEAD_STATUS_MIN_WIDTH_REM = 50;

export type RunningHeadParts = {
  /** 이름 뒤 한 줄 소개. */
  readonly line: boolean;
  /** 주황 점 + 지금 상태 한 줄. */
  readonly status: boolean;
};

export function rootFontPx(viewport: Viewport): number {
  const { rootFontPx: measured } = viewport;
  return measured !== undefined && Number.isFinite(measured) && measured > 0 ? measured : DEFAULT_ROOT_FONT_PX;
}

export function decideLayout(viewport: Viewport): PageLayout {
  const isNarrow = viewport.width <= SINGLE_LAYOUT_MAX_WIDTH_PX;
  const isTall = viewport.height >= viewport.width * SINGLE_LAYOUT_MIN_ASPECT;
  return isNarrow && isTall ? 'single' : 'spread';
}

/** 러닝 헤드에 넣을 항목. 세로 휴대폰은 이름과 쪽 번호만, 좁은 펼침 화면은 상태 줄을 뺀다(시안 still.css). */
export function runningHeadParts(viewport: Viewport, layout: PageLayout): RunningHeadParts {
  const isSpread = layout === 'spread';
  return {
    line: isSpread,
    status: isSpread && viewport.width >= RUNNING_HEAD_STATUS_MIN_WIDTH_REM * rootFontPx(viewport),
  };
}
