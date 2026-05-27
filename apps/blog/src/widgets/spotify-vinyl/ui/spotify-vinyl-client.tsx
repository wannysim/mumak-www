'use client';

import { useEffect } from 'react';

import type { NowPlaying } from '@/src/entities/spotify';
import { useProgressInterpolation, useSpotifyPolling } from '@/src/features/spotify-polling';

import { SpotifyVinyl } from './spotify-vinyl';
import { SpotifyVinylSkeleton } from './spotify-vinyl-skeleton';

interface SpotifyVinylClientProps {
  /** SSR에서 전달된 초기 데이터 */
  initialData: NowPlaying | null;
  /** 재생 중일 때 표시할 라벨 */
  listeningToLabel: string;
  /** 최근 재생 시 표시할 라벨 */
  lastPlayedLabel: string;
}

export function SpotifyVinylClient({ initialData, listeningToLabel, lastPlayedLabel }: SpotifyVinylClientProps) {
  const { data, hasTrackChanged, hasPlayStateChanged, resetChangeState, fetchedAt } = useSpotifyPolling({
    initialData,
    playingInterval: 5_000,
    pausedInterval: 30_000,
    enabled: true,
  });

  // 상태 변경 후 애니메이션 완료 시 리셋
  useEffect(() => {
    if (hasTrackChanged || hasPlayStateChanged) {
      const timer = setTimeout(() => {
        resetChangeState();
      }, 500); // 애니메이션 시간과 동기화

      return () => clearTimeout(timer);
    }
  }, [hasTrackChanged, hasPlayStateChanged, resetChangeState]);

  // Fast Refresh 시에도 initialData를 fallback으로 사용
  const displayData = data ?? initialData;

  const { progressMs: interpolatedProgressMs } = useProgressInterpolation({
    trackId: displayData?.songUrl ?? null,
    progressMs: displayData?.progressMs ?? null,
    durationMs: displayData?.durationMs ?? null,
    isPlaying: displayData?.isPlaying ?? false,
    fetchedAt: fetchedAt || Date.now(),
  });

  if (!displayData) {
    return <SpotifyVinylSkeleton />;
  }

  const statusLabel = displayData.isPlaying ? listeningToLabel : lastPlayedLabel;

  return (
    <SpotifyVinyl
      data={displayData}
      statusLabel={statusLabel}
      isTransitioning={hasTrackChanged}
      interpolatedProgressMs={interpolatedProgressMs}
    />
  );
}
