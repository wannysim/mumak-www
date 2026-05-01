import type { Metadata } from 'next';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import {
  IntlProvider,
  JsonLdScript,
  VercelAnalytics,
  generateSiteNavigationJsonLd,
  generateWebSiteJsonLd,
} from '@/src/app';
import { locales, routing, type Locale } from '@/src/shared/config/i18n';

export function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }));
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wannysim.com';
const ENABLE_VERCEL_ANALYTICS = process.env.NODE_ENV === 'production' && process.env.VERCEL === '1';

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
    locale: 'en_US',
    alternateLocale: ['ko_KR'],
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

async function LocaleContent({ params, children }: { params: Promise<{ locale: string }>; children: React.ReactNode }) {
  const { locale } = await params;

  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  const websiteJsonLd = generateWebSiteJsonLd({ locale });
  const siteNavigationJsonLd = generateSiteNavigationJsonLd({ locale });

  return (
    <IntlProvider locale={locale} messages={messages}>
      <JsonLdScript data={websiteJsonLd} />
      <JsonLdScript data={siteNavigationJsonLd} />
      {children}
      {ENABLE_VERCEL_ANALYTICS ? <VercelAnalytics /> : null}
    </IntlProvider>
  );
}

export default function LocaleLayout({ children, params }: LocaleLayoutProps) {
  return (
    <Suspense>
      <LocaleContent params={params}>{children}</LocaleContent>
    </Suspense>
  );
}
