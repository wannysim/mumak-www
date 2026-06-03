import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { routing } from '@/src/shared/config/i18n';

// 이 페이지는 즉시 기본 locale로 redirect되므로 HTML이 렌더되지 않지만,
// react-doctor/nextjs-missing-metadata 충족과 안전망용으로 최소 메타데이터를 둔다.
export const metadata: Metadata = {
  title: 'Wan Sim',
  description: 'wannysim.com',
};

// 루트 레이아웃이 더 이상 <html>/<body>를 렌더하지 않으므로(콘텐츠 정적화를 위해
// [locale]/layout.tsx로 이동), locale 없는 '/' 요청은 기본 locale로 리다이렉트한다.
// 정상 트래픽은 미들웨어가 먼저 처리하지만, 안전망으로 둔다.
export default function RootPage() {
  redirect(`/${routing.defaultLocale}`);
}
