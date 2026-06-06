import type { Metadata } from 'next';
import { getMessages, setRequestLocale } from 'next-intl/server';
import localFont from 'next/font/local';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import {
  IntlProvider,
  JsonLdScript,
  ProgressProvider,
  VercelAnalytics,
  generateSiteNavigationJsonLd,
  generateWebSiteJsonLd,
} from '@/src/app';
import { locales, routing, type Locale } from '@/src/shared/config/i18n';
import { ThemeMetaSyncScript, ThemeProvider } from '@/src/shared/lib/theme';

// <html>/<body>/폰트/테마는 locale 파라미터를 가진 이 레이아웃에서 렌더한다.
// 루트 app/layout.tsx에서 getLocale()(headers 폴백)로 locale을 읽으면 앱 전체가
// 동적 렌더링으로 강제되므로, setRequestLocale 스코프 안의 이 레이아웃으로 내려
// 콘텐츠 페이지가 정적으로 prerender되게 한다.
const pretendard = localFont({
  src: '../../public/assets/fonts/PretendardVariable.woff2',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
  display: 'swap',
  weight: '45 920',
  variable: '--font-pretendard',
});

export { themeViewport as viewport } from '@/src/shared/lib/theme';

export function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }));
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wannysim.com';
const ENABLE_VERCEL_ANALYTICS = process.env.VERCEL_ENV === 'production';

const GSC_TOKEN = process.env.NEXT_PUBLIC_GSC_TOKEN;
const NAVER_TOKEN = process.env.NEXT_PUBLIC_NAVER_TOKEN;

export const metadata: Metadata = {
  title: {
    template: '%s | Wan Sim',
    default: 'Wan Sim',
  },
  description: 'A space for thoughts and records',
  metadataBase: new URL(BASE_URL),
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    alternateLocale: ['en_US'],
    siteName: 'Wan Sim',
    title: 'Wan Sim',
    description: 'A space for thoughts and records',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wan Sim',
    description: 'A space for thoughts and records',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  ...(GSC_TOKEN || NAVER_TOKEN
    ? {
        verification: {
          ...(GSC_TOKEN ? { google: GSC_TOKEN } : {}),
          ...(NAVER_TOKEN ? { other: { 'naver-site-verification': NAVER_TOKEN } } : {}),
        },
      }
    : {}),
};

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

// <html>/<body>를 Suspense 밖, async 레이아웃 최상단에서 렌더한다. Suspense 안에
// 두면 정적 스트리밍 시 문서 셸(html lang 포함)이 지연돼 SSR 출력에서 누락된다.
export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  const websiteJsonLd = generateWebSiteJsonLd({ locale });
  const siteNavigationJsonLd = generateSiteNavigationJsonLd({ locale });

  return (
    <html lang={locale} suppressHydrationWarning className={pretendard.variable}>
      <body className="antialiased">
        {/* useServerInsertedHTML 기반이라 렌더 위치와 무관하게 초기 SSR 스트림에 삽입된다 */}
        <ThemeMetaSyncScript />
        <ThemeProvider>
          <IntlProvider locale={locale} messages={messages}>
            <ProgressProvider>
              <JsonLdScript data={websiteJsonLd} />
              <JsonLdScript data={siteNavigationJsonLd} />
              {/* children을 Suspense로 감싼다: <html>은 셸에 유지하면서, 정적
                  페이지의 useSearchParams() CSR bailout 경계를 제공한다. */}
              <Suspense>{children}</Suspense>
              {ENABLE_VERCEL_ANALYTICS ? <VercelAnalytics /> : null}
            </ProgressProvider>
          </IntlProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
