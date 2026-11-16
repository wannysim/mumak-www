import { assertPageCount } from '@/model/fold';

import { COLOPHON_PLACEHOLDER, OPENING_PAGE_LINES } from './temporary';

/**
 * 쪽 지도. 임시, open-decisions G0 "쪽 지도"(사용자 제품 결정).
 * 1쪽은 앞표지 안쪽(여는 쪽), 2–7쪽은 쪽마다 사진 한 장, 8쪽(마지막 쪽, 뒤표지 안쪽)은 판권면 자리표시다.
 * 펼침 s는 2s+1·2s+2쪽이고 02쪽 뒷면이 03쪽이다(src/model/fold/pages.ts).
 *
 * 사진은 public/photos의 Unsplash 샘플(public/assets.md)이다. 대체 텍스트는 mockups/still 시안에서 실제 이미지를 보고
 * 고친 문구를 그대로 쓰고, 시안에 없던 night는 2026-11-13 이미지를 보고 썼다. 문구 확정은 G5(U9).
 */
type PhotoPage = {
  readonly kind: 'photo';
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
};

type OpeningPage = {
  readonly kind: 'opening';
  readonly lines: readonly string[];
};

type ColophonPage = {
  readonly kind: 'colophon';
  readonly text: string;
};

export type PageContent = PhotoPage | OpeningPage | ColophonPage;

function photo(name: string, width: number, height: number, description: string): PhotoPage {
  // BASE_URL을 따라야 앱을 루트가 아닌 경로(예: 미리보기 아티팩트)에 올려도 사진이 깨지지 않는다.
  return {
    kind: 'photo',
    src: `${import.meta.env.BASE_URL}photos/${name}.jpg`,
    width,
    height,
    alt: `${description}(임시 샘플 사진)`,
  };
}

const PAGE_MAP: readonly PageContent[] = [
  { kind: 'opening', lines: OPENING_PAGE_LINES },
  photo('forest', 1200, 799, '숲속 오솔길'),
  photo('lake', 1200, 800, '산 아래 호수와 물 위 오두막'),
  photo('meadow', 1200, 800, '능선 너머 해 질 녘'),
  photo('mountain', 1200, 800, '산맥과 침엽수 골짜기'),
  photo('deer', 1200, 1981, '바위산 아래 풀밭의 사슴'),
  photo('night', 1200, 801, '은하수가 걸린 밤하늘 아래 눈 덮인 산'),
  { kind: 'colophon', text: COLOPHON_PLACEHOLDER },
];

export const PAGE_COUNT = PAGE_MAP.length;
assertPageCount(PAGE_COUNT);

/** 쪽 번호(1부터)의 내용. 지도 밖이면 RangeError(없는 쪽을 조용히 만들지 않는다, pages.ts와 같은 규칙). */
export function pageContent(page: number): PageContent {
  const content = PAGE_MAP[page - 1];
  if (content === undefined) {
    throw new RangeError(`쪽은 1 이상 ${PAGE_COUNT} 이하 정수여야 한다: ${page}`);
  }
  return content;
}

/** 사진 쪽의 이미지 주소. 이웃 펼침을 미리 받을 때 쓴다. */
export function photoSourceOf(page: number): string | null {
  const content = pageContent(page);
  return content.kind === 'photo' ? content.src : null;
}
