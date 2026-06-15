import type { CSSProperties, ReactNode } from 'react';

import type { Locale } from '@/src/shared/config/i18n';

export const OG_SIZE = { width: 1200, height: 630 } as const;

export const OG_COLORS = {
  background: '#0a0a0a',
  foreground: '#fafafa',
  muted: '#a1a1aa',
} as const;

// 제목 길이에 따라 폰트 크기를 줄여 긴 제목이 2줄 clamp 안에 들어오게 한다.
// 한국어 음절은 라틴보다 넓어 같은 글자 수라도 더 빨리 넘치므로 임계를 locale별로 분리한다.
export function resolveTitleFontSize(title: string, locale: Locale): number {
  const length = title.length;
  if (locale === 'ko') {
    if (length > 28) return 44;
    if (length > 18) return 52;
    return 64;
  }
  if (length > 52) return 44;
  if (length > 34) return 52;
  return 64;
}

// 공통 바깥 프레임: 브랜드 다크 배경 + 패딩 + Pretendard. 모든 OG 이미지가 공유한다.
export function OgShell({
  children,
  justify = 'space-between',
}: {
  children: ReactNode;
  justify?: 'space-between' | 'center';
}) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: justify,
        padding: 80,
        backgroundColor: OG_COLORS.background,
        color: OG_COLORS.foreground,
        fontFamily: 'Pretendard',
      }}
    >
      {children}
    </div>
  );
}

// 다중 라인 텍스트를 줄 수 제한 + 말줄임으로 자른다. Satori는 display:-webkit-box +
// WebkitLineClamp 조합을 지원하며, 한국어는 keep-all로 음절 중간 줄바꿈을 막는다.
export function OgClampText({
  text,
  fontSize,
  lines,
  maxWidth,
  color = OG_COLORS.foreground,
  weight,
  lineHeight,
}: {
  text: string;
  fontSize: number;
  lines: number;
  maxWidth: string;
  color?: string;
  weight?: number;
  lineHeight?: number;
}) {
  // Satori는 React와 달리 undefined style 값을 거르지 않고 .trim()을 호출하다 크래시한다.
  // 따라서 선택적 속성(weight/lineHeight)은 값이 있을 때만 객체에 넣는다.
  const style: CSSProperties = {
    fontSize,
    color,
    maxWidth,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: lines,
    WebkitBoxOrient: 'vertical',
    wordBreak: 'keep-all',
  };
  if (weight !== undefined) style.fontWeight = weight;
  if (lineHeight !== undefined) style.lineHeight = lineHeight;

  return <div style={style}>{text}</div>;
}

// 대문자 + 자간을 준 섹션 라벨(BLOG/GARDEN/카테고리 등).
export function OgEyebrow({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 24,
        color: OG_COLORS.muted,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
      }}
    >
      {children}
    </div>
  );
}

// 하단 브랜딩 푸터.
export function OgFooter() {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ fontSize: 32, fontWeight: 600 }}>Wan Sim</div>
      <div style={{ fontSize: 24, color: OG_COLORS.muted }}>wannysim.com</div>
    </div>
  );
}

// 콘텐츠를 찾지 못했을 때의 폴백 카드.
export function OgNotFound() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: OG_COLORS.background,
        color: OG_COLORS.foreground,
        fontSize: 48,
        fontFamily: 'Pretendard',
      }}
    >
      Not Found
    </div>
  );
}
