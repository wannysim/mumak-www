import type { Palette } from '@/lib/color/palette';
import type { NowPlaying } from '@/lib/spotify/types';

/** 모든 디바이스 테마가 받는 공통 props. */
export interface ThemeProps {
  nowPlaying: NowPlaying;
  palette: Palette;
  /** 진행률 보간 baseline (epoch ms). */
  fetchedAt: number;
}
