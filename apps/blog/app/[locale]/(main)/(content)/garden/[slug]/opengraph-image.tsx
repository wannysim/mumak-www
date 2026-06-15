import { ImageResponse } from 'next/og';

import { getAllNoteSlugs, getNote, getNoteEmbedPreview, type NoteStatus } from '@/src/entities/note';
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

export const alt = 'Wan Sim — Digital Garden';
export const size = OG_SIZE;
export const contentType = 'image/png';

export function generateStaticParams() {
  return locales.flatMap(locale => {
    const slugs = getAllNoteSlugs(locale);
    return slugs.map(slug => ({ locale, slug }));
  });
}

const STATUS_LABELS: Record<NoteStatus, { ko: string; en: string }> = {
  seedling: { ko: '씨앗', en: 'Seedling' },
  budding: { ko: '새싹', en: 'Budding' },
  evergreen: { ko: '상록수', en: 'Evergreen' },
};

const STATUS_COLORS: Record<NoteStatus, string> = {
  seedling: '#86efac',
  budding: '#fcd34d',
  evergreen: '#34d399',
};

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

// 폰트 로딩은 요청마다 동일하므로 모듈 스코프에서 한 번만 수행한다.
const fontOptionsPromise = loadOgFonts().then(fonts => ({ ...size, fonts }));

export default async function Image({ params }: Props) {
  const [{ locale, slug }, fontOptions] = await Promise.all([params, fontOptionsPromise]);

  const note = getNote(locale as Locale, slug);

  if (!note) {
    return new ImageResponse(<OgNotFound />, fontOptions);
  }

  const typedLocale = locale as Locale;
  const statusLabel = STATUS_LABELS[note.meta.status][locale === 'ko' ? 'ko' : 'en'];
  const statusColor = STATUS_COLORS[note.meta.status];
  const excerpt = getNoteEmbedPreview(typedLocale, slug)?.excerpt ?? '';

  return new ImageResponse(
    <OgShell>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <OgEyebrow>Garden</OgEyebrow>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 22,
            color: statusColor,
            border: `2px solid ${statusColor}`,
            borderRadius: 999,
            padding: '6px 18px',
          }}
        >
          {statusLabel}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <OgClampText
          text={note.meta.title}
          fontSize={resolveTitleFontSize(note.meta.title, typedLocale)}
          weight={700}
          lineHeight={1.2}
          lines={2}
          maxWidth="95%"
        />
        {excerpt ? <OgClampText text={excerpt} fontSize={28} color="#a1a1aa" lines={2} maxWidth="85%" /> : null}
      </div>

      <OgFooter />
    </OgShell>,
    fontOptions
  );
}
