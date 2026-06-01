import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { getPost, isValidCategory } from '@/src/entities/post';
import { type Locale } from '@/src/shared/config/i18n';

export const alt = 'Blog Post';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

// 이미지는 Satori(next/og)가 런타임에 생성한다. 현재 폰트(woff2)는 Satori가
// 지원하지 않아 빌드 타임 prerender가 실패하므로 on-demand 동적 생성으로 유지한다.
// (콘텐츠 페이지 정적화와 무관 — OG 이미지는 크롤러 전용 경로다.)
export const dynamic = 'force-dynamic';

async function loadFont(): Promise<ArrayBuffer> {
  const fontPath = join(process.cwd(), 'public', 'assets', 'fonts', 'PretendardVariable.woff2');
  const fontData = await readFile(fontPath);
  return fontData.buffer.slice(fontData.byteOffset, fontData.byteOffset + fontData.byteLength);
}

interface Props {
  params: Promise<{ locale: string; category: string; slug: string }>;
}

export default async function Image({ params }: Props) {
  const { locale, category, slug } = await params;

  const fontData = await loadFont();
  const fontOptions = {
    ...size,
    fonts: [
      {
        name: 'Pretendard',
        data: fontData,
        style: 'normal' as const,
        weight: 400 as const,
      },
    ],
  };

  if (!isValidCategory(category)) {
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

  const post = getPost(locale as Locale, category, slug);

  if (!post) {
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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <div
          style={{
            fontSize: 24,
            color: '#a1a1aa',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          {category}
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.2,
            maxWidth: '90%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {post.meta.title}
        </div>
        <div
          style={{
            fontSize: 28,
            color: '#a1a1aa',
            maxWidth: '80%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {post.meta.description}
        </div>
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
