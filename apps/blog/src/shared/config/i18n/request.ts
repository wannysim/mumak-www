import { getRequestConfig } from 'next-intl/server';

import { type Locale, locales } from './config';
import { routing } from './routing';

// 정적 경로의 import 맵: 번들러가 로케일별 청크로 분리할 수 있고,
// 지원 로케일이 타입으로 강제된다 (템플릿 리터럴 동적 경로 제거).
const messageLoaders: Record<Locale, () => Promise<{ default: Record<string, unknown> }>> = {
  ko: () => import('@/messages/ko.json'),
  en: () => import('@/messages/en.json'),
};

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: Locale = locales.includes(requested as Locale) ? (requested as Locale) : routing.defaultLocale;

  return {
    locale,
    messages: (await messageLoaders[locale]()).default,
    timeZone: locale === 'ko' ? 'Asia/Seoul' : 'UTC',
  };
});
