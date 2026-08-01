'use client';

import { LaptopIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';

import { Button } from '@mumak/ui/components/button';

import { useHydrated } from '@/src/shared/hooks';
import { type ThemeValue } from '@/src/shared/lib/theme';
import { SwitcherDropdown } from '@/src/shared/ui/switcher-dropdown';

const themeOptions: Array<{ value: ThemeValue; label: string; Icon: typeof SunIcon }> = [
  { value: 'light', label: 'Light', Icon: SunIcon },
  { value: 'dark', label: 'Dark', Icon: MoonIcon },
  { value: 'system', label: 'System', Icon: LaptopIcon },
];

function ThemeIcon() {
  return (
    <>
      <SunIcon className="size-4 block dark:hidden" aria-hidden />
      <MoonIcon className="size-4 hidden dark:block" aria-hidden />
    </>
  );
}

export function ThemeSwitcher() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const t = useTranslations('common');
  // next-themes의 theme 값은 서버에서 알 수 없으므로 하이드레이션 전에는
  // placeholder 버튼을 그린다. useHydrated는 하이드레이션 중 동기 전환되어
  // mounted-state 패턴과 달리 paint 후 깜빡임이 없다.
  const mounted = useHydrated();

  const selectedTheme: ThemeValue = mounted && theme ? (theme as ThemeValue) : 'system';

  const effectiveTheme: ThemeValue = mounted
    ? selectedTheme === 'system'
      ? ((resolvedTheme as ThemeValue | undefined) ?? 'system')
      : selectedTheme
    : 'system';

  const TriggerIcon = effectiveTheme === 'system' ? LaptopIcon : effectiveTheme === 'dark' ? MoonIcon : SunIcon;

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon-sm" aria-label={t('changeTheme')}>
        <ThemeIcon />
      </Button>
    );
  }

  return (
    <SwitcherDropdown
      ariaLabel={t('changeTheme')}
      triggerIcon={TriggerIcon}
      selectedValue={selectedTheme}
      onValueChange={value => setTheme(value as ThemeValue)}
      options={themeOptions.map(option => ({
        value: option.value,
        label: option.label,
        icon: option.Icon,
      }))}
    />
  );
}
