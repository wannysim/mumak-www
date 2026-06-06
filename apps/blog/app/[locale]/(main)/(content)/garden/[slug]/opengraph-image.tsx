import { ImageResponse } from 'next/og';

import { getAllNoteSlugs, getNote, getNoteEmbedPreview, type NoteStatus } from '@/src/entities/note';
import { locales, type Locale } from '@/src/shared/config/i18n';
import { loadOgFonts } from '@/src/shared/lib/og';

export const alt = 'Digital Garden Note';
export const size = {
  width: 1200,
  height: 630,
};
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

// 폰트 로딩은 요청마다 동일하므로 모듈 스코프에서 한 번만 수행한다.
const fontOptionsPromise = loadOgFonts().then(fonts => ({ ...size, fonts }));

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function Image({ params }: Props) {
  const [{ locale, slug }, fontOptions] = await Promise.all([params, fontOptionsPromise]);

  const note = getNote(locale as Locale, slug);

  if (!note) {
    return new ImageResponse(
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          color: '#fafafa',
          fontSize: 48,
          fontFamily: 'Pretendard',
        }}
      >
        Not Found
      </div>,
      fontOptions
    );
  }

  const statusLabel = STATUS_LABELS[note.meta.status][locale === 'ko' ? 'ko' : 'en'];
  const statusColor = STATUS_COLORS[note.meta.status];
  const excerpt = getNoteEmbedPreview(locale as Locale, slug)?.excerpt ?? '';

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 80,
        backgroundColor: '#0a0a0a',
        color: '#fafafa',
        fontFamily: 'Pretendard',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div
          style={{
            fontSize: 24,
            color: '#a1a1aa',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Garden
        </div>
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

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.2,
            maxWidth: '95%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {note.meta.title}
        </div>
        {excerpt ? (
          <div
            style={{
              fontSize: 28,
              color: '#a1a1aa',
              maxWidth: '85%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {excerpt}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            fontSize: 32,
            fontWeight: 600,
          }}
        >
          Wan Sim
        </div>
        <div
          style={{
            fontSize: 24,
            color: '#a1a1aa',
          }}
        >
          wannysim.com
        </div>
      </div>
    </div>,
    fontOptions
  );
}
