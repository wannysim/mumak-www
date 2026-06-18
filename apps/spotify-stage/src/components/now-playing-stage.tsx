import type { CSSProperties } from 'react';

import type { Palette } from '@/lib/color/palette';
import type { ThemeChoice } from '@/lib/settings/config';
import type { NowPlaying } from '@/lib/spotify/types';
import { resolveThemeByChoice } from '@/themes/registry';

/**
 * 선택된 테마('auto' 면 실제 device.type)를 골라 ambient 배경 위에 렌더한다.
 * 팔레트는 CSS 변수로 내려 ProgressBar/TV 글로우 등 하위 요소가 공유한다.
 */
export function NowPlayingStage({
  nowPlaying,
  palette,
  fetchedAt,
  themeChoice,
}: {
  nowPlaying: NowPlaying;
  palette: Palette;
  fetchedAt: number;
  themeChoice: ThemeChoice;
}) {
  const Theme = resolveThemeByChoice(themeChoice, nowPlaying.device?.type);

  const stageStyle = {
    '--stage-accent': palette.accent,
    '--stage-dominant': palette.dominant,
    '--stage-base': palette.base,
    color: '#fafafa',
  } as CSSProperties;

  return (
    <main className="relative min-h-svh w-full" style={stageStyle}>
      <Theme nowPlaying={nowPlaying} palette={palette} fetchedAt={fetchedAt} />
    </main>
  );
}
