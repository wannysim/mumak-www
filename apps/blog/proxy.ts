import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';

import { routing } from '@/src/shared/config/i18n';

const intlMiddleware = createMiddleware(routing);

export function proxy(request: NextRequest) {
  return intlMiddleware(request);
}

export const config = {
  // localePrefix: 'always'라서 미들웨어가 모든 페이지 요청을 타야 한다. 이미-prefix된
  // 경로만 매칭하면 prefix 없는 경로(/wlkhdhwd 등)가 미들웨어를 건너뛰어 유효하지 않은
  // locale로 취급돼 Next 기본 404로 떨어진다. next-intl 표준 matcher를 쓰되, 확장자
  // 없는 root 라우트 핸들러(icon)와 파일형 경로(.txt/.xml/.webmanifest 등)·api·내부
  // 경로는 제외해 locale prefix가 잘못 붙지 않게 한다.
  matcher: ['/((?!api|_next|_vercel|icon|.*\\..*).*)'],
};
