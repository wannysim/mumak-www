'use client';

import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import Script from 'next/script';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

function GoogleAnalytics() {
  if (!GA_ID) {
    return null;
  }

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}

export function VercelAnalytics() {
  return (
    <>
      <Analytics />
      <SpeedInsights />
      <GoogleAnalytics />
    </>
  );
}
