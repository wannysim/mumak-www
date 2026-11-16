/**
 * 쪽 번호 표기. georgehatton식 한 줄 쪽 표시(`03/24`)를 따른다(open-decisions G0 차용 후보, 형식은 임시).
 * 두 자리로 채우고 펼침은 en dash(–)로 잇는다. 예: 펼침 "03–04", 한 쪽 "05", 전체와 함께 "03–04/08".
 */
const PAGE_NUMBER_DIGITS = 2;

export function formatPageNumber(page: number): string {
  return String(page).padStart(PAGE_NUMBER_DIGITS, '0');
}

/** 보이는 쪽 묶음. [3, 4] → "03–04", [5] → "05". */
export function formatPageSpan(pages: readonly number[]): string {
  return pages.map(formatPageNumber).join('–');
}

export function formatFolio(pages: readonly number[], pageCount: number): string {
  return `${formatPageSpan(pages)}/${formatPageNumber(pageCount)}`;
}
