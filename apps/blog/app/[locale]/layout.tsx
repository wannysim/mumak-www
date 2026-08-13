import type { Metadata } from 'next';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import localFont from 'next/font/local';
import { notFound } from 'next/navigation';

import {
  GoogleAnalytics,
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
// 본문 폰트는 Pretendard Variable의 서브셋이다(Latin + 전체 현대 한글 + 공통 구두점,
// wght 400~700). 원본(2.1MB, 전 축 + 한자/다국어)은 fonts/PretendardVariable.source.woff2,
// 재생성은 scripts/subset-body-font.sh 참조. 미포함 글리프(한자 등)는 fallback으로 대체된다.
const pretendard = localFont({
  src: '../../fonts/PretendardVariableSubset.woff2',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
  display: 'swap',
  weight: '400 700',
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

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

// openGraph/twitter에 title·description을 적지 않는다. 적으면 그 값이 모든 하위 페이지로
// 상속돼 탭 제목('블로그 | Wan Sim')과 링크 프리뷰 제목('Wan Sim')이 갈린다. 비워 두면
// Next가 각 페이지의 resolved title/description을 그대로 물려준다.
// 같은 이유로 페이지 쪽에서도 openGraph를 통째로 교체하지 않는다 — 교체하면 이 레이아웃
// 세그먼트에 붙은 opengraph-image.tsx(콘텐츠 해시 쿼리 포함)까지 함께 날아간다.
export async function generateMetadata({ params }: Pick<LocaleLayoutProps, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });

  return {
    title: {
      template: '%s | Wan Sim',
      default: 'Wan Sim',
    },
    description: t('description'),
    metadataBase: new URL(BASE_URL),
    openGraph: {
      type: 'website',
      locale: locale === 'ko' ? 'ko_KR' : 'en_US',
      alternateLocale: [locale === 'ko' ? 'en_US' : 'ko_KR'],
      siteName: 'Wan Sim',
    },
    twitter: {
      card: 'summary_large_image',
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
}

// <html>/<body>는 async 레이아웃 최상단에서 렌더한다. children을 Suspense로 감싸지
// 않는다 — 감싸면 동적 렌더(404 catch-all, SSG miss)에서 셸이 먼저 flush돼
// notFound()가 status code를 404로 바꾸지 못하고 200 + noindex(soft-404)로 굳는다.
// useSearchParams CSR bailout 경계는 사용처(ProgressProvider 내부, graph 페이지)가
// 각자 로컬 Suspense로 제공한다.
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
              {children}
              {ENABLE_VERCEL_ANALYTICS ? <VercelAnalytics /> : null}
              {/* GA는 Vercel 게이트 밖 — 홈서버 프로덕션(VERCEL_ENV 없음)에서도 켜져야 한다.
                  NEXT_PUBLIC_GA_ID 미설정(dev/프리뷰)이면 스스로 null. */}
              <GoogleAnalytics />
            </ProgressProvider>
          </IntlProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
