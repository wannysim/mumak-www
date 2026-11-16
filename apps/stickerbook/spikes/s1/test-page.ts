// 시험 쪽: DOM 패널과 foreignObject 래스터가 같은 HTML과 같은 CSS 문자열을 쓴다.
// 회색 플레이스홀더이며 시안이 아니다. 쪽 크기·서체·문구·색은 모두 임시값이다(판형·서체는 G0·G1 사용자 결정).

import type { Size } from './raster-math';

export const TEST_FONT_FAMILY = 'S1 Pretendard';
/** Pretendard Variable의 굵기 축 범위. */
export const TEST_FONT_WEIGHT_RANGE = '45 920';
export const TEST_PHOTO_URL = '/photos/forest.jpg';
/** 임시: 판형은 G0에서 정한다. ?w=&h=로 바꿀 수 있다. */
export const DEFAULT_PAGE_CSS_SIZE: Size = { width: 400, height: 560 };
const TEST_TEXT_SIZES_PX = [10, 11, 12, 16] as const;

const SMALL_COPY = {
  ko: '판권면처럼 작은 글자가 모인 쪽이다. 받침과 겹받침(값, 읊, 닭, 뷁)이 뭉개지는지 본다.',
  en: 'Colophon check: Il1| O0 rn m 0123456789. The quick brown fox jumps over the lazy dog.',
};

const LARGE_COPY = {
  ko: '사진 한 장과 넉넉한 여백.',
  en: 'One photo per page.',
};

// all: initial로 하네스 문서의 상속값을 끊는다. SVG 안에는 하네스 CSS가 없으므로 두 경로의 출발점을 맞춘다.
// 서체가 없으면 serif로 떨어지게 해서 임베드 실패가 눈에 보이게 한다.
// 줄바꿈 규칙(word-break)은 미정이라 기본값 그대로 둔다(임시).
export const TEST_PAGE_CSS = `
.s1-page {
  all: initial;
  display: block;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  margin: 0;
  padding: 18px 22px;
  background: #e4e4e4;
  color: #1c1c1c;
  font-family: "${TEST_FONT_FAMILY}", serif;
  font-size: 12px;
  font-weight: 400;
  font-style: normal;
  line-height: 1.5;
  letter-spacing: 0;
  text-align: start;
}
.s1-page * {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
.s1-photo {
  display: block;
  width: 100%;
  height: 120px;
  object-fit: cover;
  background: #bdbdbd;
}
.s1-sample {
  display: block;
  margin-top: 8px;
}
.s1-label {
  display: block;
  font-size: 10px;
  color: #6a6a6a;
  font-variant-numeric: tabular-nums;
}
.s1-sample p {
  display: block;
}
.s1-size-10 { font-size: 10px; }
.s1-size-11 { font-size: 11px; }
.s1-size-12 { font-size: 12px; }
.s1-size-16 { font-size: 16px; }
.s1-stripes {
  display: block;
  height: 6px;
  margin-top: 8px;
  background: repeating-linear-gradient(90deg, #000 0 1px, #fff 1px 2px);
}
.s1-folio {
  position: absolute;
  right: 22px;
  bottom: 12px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
`;

export function createTestPage(doc: Document, cssSize: Size): HTMLElement {
  const page = doc.createElement('article');
  page.className = 's1-page';
  page.lang = 'ko';
  page.setAttribute('aria-label', '시험 쪽(회색 플레이스홀더)');
  setTestPageSize(page, cssSize);

  const photo = doc.createElement('img');
  photo.className = 's1-photo';
  photo.src = TEST_PHOTO_URL;
  photo.alt = '숲 사진(시험용)';
  photo.dataset.probe = 'photo';
  page.append(photo);

  for (const sizePx of TEST_TEXT_SIZES_PX) {
    const copy = sizePx >= 16 ? LARGE_COPY : SMALL_COPY;
    const sample = doc.createElement('section');
    sample.className = `s1-sample s1-size-${sizePx}`;
    sample.append(
      createParagraph(doc, 's1-label', `${sizePx}px`, { probe: `text-${sizePx}px-label` }),
      createParagraph(doc, '', copy.ko, { lang: 'ko', probe: `text-${sizePx}px-ko` }),
      createParagraph(doc, '', copy.en, { lang: 'en', probe: `text-${sizePx}px-en` })
    );
    page.append(sample);
  }

  const stripes = doc.createElement('div');
  stripes.className = 's1-stripes';
  stripes.setAttribute('aria-hidden', 'true');
  page.append(stripes);

  page.append(createParagraph(doc, 's1-folio', '03/24', { probe: 'text-folio' }));
  return page;
}

export function setTestPageSize(page: HTMLElement, cssSize: Size): void {
  page.style.width = `${cssSize.width}px`;
  page.style.height = `${cssSize.height}px`;
}

type ParagraphOptions = { lang?: string; probe: string };

/** data-probe: 래스터 뒤 글자·사진이 실제로 그려졌는지 확인할 영역 이름(foreign-object-raster.ts). */
function createParagraph(
  doc: Document,
  className: string,
  text: string,
  options: ParagraphOptions
): HTMLParagraphElement {
  const paragraph = doc.createElement('p');
  if (className) paragraph.className = className;
  if (options.lang) paragraph.lang = options.lang;
  paragraph.dataset.probe = options.probe;
  paragraph.textContent = text;
  return paragraph;
}
