'use client';

import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import Script from 'next/script';

export function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  if (!gaId) {
    return null;
  }

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
    </>
  );
}

// GoogleAnalytics는 여기 포함하지 않는다 — VercelAnalytics는 VERCEL_ENV 게이트 뒤에서만
// 렌더되므로, 여기 넣으면 홈서버(셀프호스트) 프로덕션에서 GA가 조용히 꺼진다.
// GA는 레이아웃에서 게이트 밖에 별도로 렌더하고, gaId 부재 시 스스로 null을 반환한다.
export function VercelAnalytics() {
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
