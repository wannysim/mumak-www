import { useEffect, useState } from 'react';

import type { NowPlaying } from '@/lib/spotify/types';

/**
 * 폴링 사이에도 진행 막대가 부드럽게 흐르도록, 마지막 fetch 시각을 baseline 으로
 * 경과 시간을 보간한다. 재생 중일 때만 시간을 흐르게 하고 곡 길이에서 멈춘다.
 */
export function useInterpolatedProgress(nowPlaying: NowPlaying | null, fetchedAt: number): number {
  const [elapsed, setElapsed] = useState(0);

  const baseProgress = nowPlaying?.progressMs ?? 0;
  const duration = nowPlaying?.durationMs ?? 0;
  const isPlaying = nowPlaying?.isPlaying ?? false;

  useEffect(() => {
    if (!isPlaying || !fetchedAt || duration === 0) {
      setElapsed(0);
      return;
    }

    const update = () => setElapsed(Math.max(0, Date.now() - fetchedAt));
    update();
    const intervalId = window.setInterval(update, 250);
    return () => window.clearInterval(intervalId);
  }, [isPlaying, fetchedAt, duration, baseProgress]);

  if (duration === 0) {
    return 0;
  }
  return Math.min(duration, baseProgress + (isPlaying ? elapsed : 0));
}
