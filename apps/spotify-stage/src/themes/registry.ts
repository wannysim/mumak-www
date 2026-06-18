import type { ComponentType } from 'react';

import type { ThemeChoice } from '@/lib/settings/config';
import type { SpotifyDeviceType } from '@/lib/spotify/types';
import { ThemeAutomobile } from '@/themes/theme-automobile';
import { ThemeComputer } from '@/themes/theme-computer';
import { ThemeFallback } from '@/themes/theme-fallback';
import { ThemeSmartphone } from '@/themes/theme-smartphone';
import { ThemeTV } from '@/themes/theme-tv';
import type { ThemeProps } from '@/themes/types';

/** 주로 쓰는 4종 디바이스에 전용 테마를 매핑하고, 나머지는 fallback 으로 보낸다. */
const THEME_BY_DEVICE: Partial<Record<SpotifyDeviceType, ComponentType<ThemeProps>>> = {
  Computer: ThemeComputer,
  Smartphone: ThemeSmartphone,
  Automobile: ThemeAutomobile,
  TV: ThemeTV,
};

/** 강제 선택용 테마 매핑. */
const THEME_BY_CHOICE: Record<Exclude<ThemeChoice, 'auto'>, ComponentType<ThemeProps>> = {
  computer: ThemeComputer,
  smartphone: ThemeSmartphone,
  automobile: ThemeAutomobile,
  tv: ThemeTV,
  fallback: ThemeFallback,
};

/** 실제 device.type 기반 테마 해석. */
export function resolveTheme(deviceType: SpotifyDeviceType | undefined): ComponentType<ThemeProps> {
  if (!deviceType) {
    return ThemeFallback;
  }
  return THEME_BY_DEVICE[deviceType] ?? ThemeFallback;
}

/** 사용자가 고른 테마('auto' 면 실제 기기) 기반 해석. */
export function resolveThemeByChoice(
  choice: ThemeChoice,
  deviceType: SpotifyDeviceType | undefined
): ComponentType<ThemeProps> {
  if (choice === 'auto') {
    return resolveTheme(deviceType);
  }
  return THEME_BY_CHOICE[choice];
}
