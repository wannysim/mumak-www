import { redirect } from 'next/navigation';

import { routing } from '@/src/shared/config/i18n';

// 루트 레이아웃이 더 이상 <html>/<body>를 렌더하지 않으므로(콘텐츠 정적화를 위해
// [locale]/layout.tsx로 이동), locale 없는 '/' 요청은 기본 locale로 리다이렉트한다.
// 정상 트래픽은 미들웨어가 먼저 처리하지만, 안전망으로 둔다.
export default function RootPage() {
  redirect(`/${routing.defaultLocale}`);
}
