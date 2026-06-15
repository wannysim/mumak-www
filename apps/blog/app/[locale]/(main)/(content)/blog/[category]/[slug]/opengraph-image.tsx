import { ImageResponse } from 'next/og';

import { getAllPostSlugs, getCategoryLabel, getPost, isValidCategory } from '@/src/entities/post';
import { locales, type Locale } from '@/src/shared/config/i18n';
import {
  loadOgFonts,
  OgClampText,
  OgEyebrow,
  OgFooter,
  OgNotFound,
  OgShell,
  OG_SIZE,
  resolveTitleFontSize,
} from '@/src/shared/lib/og';

export const alt = 'Wan Sim — Blog';
export const size = OG_SIZE;
export const contentType = 'image/png';

export function generateStaticParams() {
  return locales.flatMap(locale => {
    const slugs = getAllPostSlugs(locale);
    return slugs.map(({ category, slug }) => ({ locale, category, slug }));
  });
}

interface Props {
  params: Promise<{ locale: string; category: string; slug: string }>;
}

// 폰트 로딩은 요청마다 동일하므로 모듈 스코프에서 한 번만 수행한다.
const fontOptionsPromise = loadOgFonts().then(fonts => ({ ...size, fonts }));

export default async function Image({ params }: Props) {
  const [{ locale, category, slug }, fontOptions] = await Promise.all([params, fontOptionsPromise]);

  if (!isValidCategory(category)) {
    return new ImageResponse(<OgNotFound />, fontOptions);
  }

  const post = getPost(locale as Locale, category, slug);

  if (!post) {
    return new ImageResponse(<OgNotFound />, fontOptions);
  }

  const typedLocale = locale as Locale;

  return new ImageResponse(
    <OgShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <OgEyebrow>{getCategoryLabel(category, typedLocale)}</OgEyebrow>
        <OgClampText
          text={post.meta.title}
          fontSize={resolveTitleFontSize(post.meta.title, typedLocale)}
          weight={700}
          lineHeight={1.2}
          lines={2}
          maxWidth="90%"
        />
        {post.meta.description ? (
          <OgClampText text={post.meta.description} fontSize={28} color="#a1a1aa" lines={2} maxWidth="80%" />
        ) : null}
      </div>
      <OgFooter />
    </OgShell>,
    fontOptions
  );
}
