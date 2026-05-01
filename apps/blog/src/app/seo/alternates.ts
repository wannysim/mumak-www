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
  };
}
