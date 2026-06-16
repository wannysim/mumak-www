import { defaultLocale, locales, type Locale } from '@/src/shared/config/i18n/config';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wannysim.com';

interface BuildAlternatesParams {
  locale: string;
  path: string;
  availableLocales?: readonly Locale[];
}

interface AlternatesResult {
  canonical: string;
  languages: Record<string, string>;
  types: Record<string, string>;
}

export function buildAlternates({ locale, path, availableLocales }: BuildAlternatesParams): AlternatesResult {
  const langs = availableLocales ?? locales;
  const normalizedPath = path === '' || path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;

  const languages: Record<string, string> = {};
  for (const lang of langs) {
    languages[lang] = `${BASE_URL}/${lang}${normalizedPath}`;
  }
  if (langs.includes(defaultLocale)) {
    languages['x-default'] = `${BASE_URL}/${defaultLocale}${normalizedPath}`;
  }

  return {
    canonical: `${BASE_URL}/${locale}${normalizedPath}`,
    languages,
    // RSS autodiscovery: 모든 페이지가 현재 locale의 피드를 <link rel="alternate">로 광고한다.
    // buildAlternates를 단일 소스로 둬서 페이지마다 인라인으로 추가하지 않는다.
    types: {
      'application/rss+xml': `${BASE_URL}/${locale}/feed.xml`,
    },
  };
}
