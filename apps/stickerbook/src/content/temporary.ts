import { formatPageSpan } from '@/model/book/folio';
import type { CoverFace } from '@/model/book/rotation';

/**
 * 1페이즈 임시 문구와 표지 내용. 모두 사용자 결정 전 자리표시이며, 결정 항목은 각 상수 주석의 open-decisions 행이다.
 * 동작 수치(회전·넘김·전환 시간, 화면 치수)는 각 모델 모듈 위쪽 상수에 같은 형식의 주석과 함께 있다:
 * src/model/book/{rotation,layout,geometry,opening,easing,turn-session,book-state}.ts.
 * 그림만의 값(접지 그림자 배수)은 src/features/closed-book/closed-book.tsx 위쪽 상수, 테두리·그늘·포커스 표시·
 * 러닝 헤드 배치는 각 컴포넌트 CSS·주석(closed-book.css, book-spread.css, book-page.css, running-head.tsx, src/index.css)에
 * 같은 형식으로 적었다.
 * 이름 "심완"은 확정된 사용자 결정(표지 = fursona 명함)에 따라 앞표지에 둔다.
 */

export const PERSON_NAME = '심완';

/** 앞표지(명함 앞면) 이름 아래 한 줄. 임시, open-decisions G0 "앞표지·뒤표지·책등에 넣을 정보". */
export const COVER_TAGLINE = '사진 찍는 개발자';

/**
 * 뒤표지(명함 뒷면) 정보. 임시, open-decisions G0 "앞표지·뒤표지·책등에 넣을 정보"·G5 "판권면 실제 값과 공개 범위".
 * 실제 연락처·사는 곳이 아니라 자리표시다.
 */
export const COVER_BACK_LINES: readonly string[] = ['example@mail.com', 'instagram.com/example', '사는 곳 · 임시'];

/** 러닝 헤드 문구. 임시, open-decisions G4 "러닝 헤드 항목·문구, '지금 상태 한 줄'의 출처"(시안 문구 그대로). */
export const RUNNING_HEAD_LINE = '사진을 찍고 화면을 만든다';
export const RUNNING_HEAD_STATUS = '지금 다음 호에 실을 사진을 고르는 중';

/** 닫힌 책일 때 러닝 헤드 쪽 번호 자리. 임시, open-decisions G4 "러닝 헤드 … 닫힌 책 상태에서 보일지"(시안 closed-a·c). */
export const FACE_LABELS: Readonly<Record<CoverFace, string>> = {
  front: '앞표지',
  spine: '책등',
  back: '뒤표지',
  fore: '책배',
};

/** 1쪽(앞표지 안쪽, 여는 쪽) 문구. 임시, open-decisions G0 "쪽 지도". */
export const OPENING_PAGE_LINES: readonly string[] = [PERSON_NAME, '사진 · 임시'];

/** 마지막 쪽 판권면 자리표시. 실제 항목·값은 1페이즈 범위 밖(open-decisions G4 판권면 항목, G5 실제 값). */
export const COLOPHON_PLACEHOLDER = '판권면 · 임시';

/** 버튼 이름·쪽 알림·설명 문구. 임시, open-decisions G5 "버튼 이름, 쪽 알림 형식, 사진 대체 텍스트 문구"(tech-research.md 7장 U9). */
export const UI_TEXT = {
  openBook: '책 펼치기',
  rotateHint: '화살표 키로 돌려 볼 수 있다.',
  bookRegion: '펼친 책',
  previousPage: '이전 쪽',
  nextPage: '다음 쪽',
} as const;

/** 닫힌 책 버튼 설명. 각도와 무관하게 앞·뒤표지 정보를 DOM 텍스트로 둔다(tech-research.md 7장 닫힌 책 회전 행). */
export function coverDescription(): string {
  return `앞표지: ${PERSON_NAME}, ${COVER_TAGLINE}. 뒤표지: ${COVER_BACK_LINES.join(', ')}. ${UI_TEXT.rotateHint}`;
}

/** 착지 알림. 예: "03–04쪽". */
export function landingAnnouncement(pages: readonly number[]): string {
  return `${formatPageSpan(pages)}쪽`;
}

/** 러닝 헤드 쪽 번호의 읽기용 문구. 보이는 숫자는 aria-hidden이다. */
export function folioReading(pages: readonly number[], pageCount: number): string {
  return `${formatPageSpan(pages)}쪽, 전체 ${pageCount}쪽`;
}
