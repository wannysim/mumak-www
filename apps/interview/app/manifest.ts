import type { MetadataRoute } from 'next';

import { themeColors } from '@/lib/theme';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: '다음 정거장 · 나의 면접 연습실',
    short_name: '다음 정거장',
    description: '이동 중에도, 한 문제만 더.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    lang: 'ko',
    background_color: themeColors.light,
    theme_color: themeColors.light,
    icons: [
      { src: '/icons/interview-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/interview-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
