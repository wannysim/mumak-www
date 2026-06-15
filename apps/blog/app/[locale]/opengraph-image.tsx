import { ImageResponse } from 'next/og';

import { locales, type Locale } from '@/src/shared/config/i18n';
import { loadOgFonts, OgEyebrow, OgFooter, OgShell, OG_COLORS, OG_SIZE } from '@/src/shared/lib/og';

export const alt = 'Wan Sim — A space for thoughts and records';
export const size = OG_SIZE;
export const contentType = 'image/png';

// Next 파일 컨벤션상 이 기본 이미지는 하위 세그먼트(home/blog 인덱스/garden 인덱스/
// tags/about/now)에 상속되고, 슬러그 레벨 opengraph-image가 있으면 그쪽이 우선한다.
// 즉 파일 하나로 슬러그 외 전 페이지의 OG 이미지 부재를 메운다.
export function generateStaticParams() {
  return locales.map(locale => ({ locale }));
}

const TAGLINES: Record<Locale, string> = {
  ko: '생각과 기록을 담는 공간',
  en: 'A space for thoughts and records',
};

interface Props {
  params: Promise<{ locale: string }>;
}

// 폰트 로딩은 요청마다 동일하므로 모듈 스코프에서 한 번만 수행한다.
const fontOptionsPromise = loadOgFonts().then(fonts => ({ ...size, fonts }));

export default async function Image({ params }: Props) {
  const [{ locale }, fontOptions] = await Promise.all([params, fontOptionsPromise]);
  const tagline = TAGLINES[locale as Locale] ?? TAGLINES.en;

  return new ImageResponse(
    <OgShell>
      <OgEyebrow>Blog · Digital Garden</OgEyebrow>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ fontSize: 112, fontWeight: 700, lineHeight: 1.1 }}>Wan Sim</div>
        <div style={{ fontSize: 36, color: OG_COLORS.muted }}>{tagline}</div>
      </div>
      <OgFooter />
    </OgShell>,
    fontOptions
  );
}
