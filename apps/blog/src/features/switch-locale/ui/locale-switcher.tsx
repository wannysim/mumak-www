'use client';

import { GlobeIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { type Locale, usePathname, useRouter } from '@/src/shared/config/i18n';
import { SwitcherDropdown } from '@/src/shared/ui/switcher-dropdown';

const localeNames: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
};

const localeOptions: Array<{ value: Locale; label: string; icon?: typeof GlobeIcon; emoji?: string }> = [
  { value: 'ko', label: localeNames.ko, emoji: '🇰🇷' },
  { value: 'en', label: localeNames.en, emoji: '🇺🇸' },
];

export function LocaleSwitcher() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  // 옵션 라벨(한국어/English)은 각 언어 자신의 표기라 번역하지 않는다. 트리거의 접근 가능한
  // 이름만 현재 로케일 문구를 쓴다 — 바로 옆 ThemeSwitcher와 한 언어로 읽혀야 한다.
  const t = useTranslations('common');

  return (
    <SwitcherDropdown
      ariaLabel={t('changeLanguage')}
      triggerIcon={GlobeIcon}
      selectedValue={locale}
      onValueChange={value => {
        router.replace(pathname, { locale: value });
      }}
      options={localeOptions}
    />
  );
}
