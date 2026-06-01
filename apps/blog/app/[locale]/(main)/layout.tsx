import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { Footer, FooterSkeleton } from '@/src/widgets/footer';
import { HeaderSpacer, Navigation, NavigationSkeleton, SmartHeader } from '@/src/widgets/header';

// Navigation/Footer가 getTranslations()를 쓰므로, 이 레이아웃 스코프에서
// setRequestLocale을 호출해 정적 렌더링을 유지한다. (상위 [locale] 레이아웃의
// 호출은 Suspense 경계를 넘어 항상 전파되지는 않는다 — next-intl 권장대로
// "관련된 모든 레이아웃·페이지"에 추가한다.)
export default async function MainLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:rounded-md focus:border focus:border-border focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <div className="min-h-screen flex flex-col">
        <SmartHeader>
          <Suspense fallback={<NavigationSkeleton />}>
            <Navigation />
          </Suspense>
        </SmartHeader>
        <HeaderSpacer />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Suspense fallback={<FooterSkeleton />}>
          <Footer />
        </Suspense>
      </div>
    </>
  );
}
