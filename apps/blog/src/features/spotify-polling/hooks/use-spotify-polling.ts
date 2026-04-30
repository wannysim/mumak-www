import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';

import type { NowPlaying } from '@/src/entities/spotify';

interface NowPlayingResponse {
  data: NowPlaying | null;
  timestamp: number;
}

interface UseSpotifyPollingOptions {
  /** 초기 데이터 (SSR에서 전달) */
  initialData?: NowPlaying | null;
  /** 재생 중일 때 폴링 간격 (ms) */
  playingInterval?: number;
  /** 일시정지 시 폴링 간격 (ms) */
  pausedInterval?: number;
  /** 폴링 활성화 여부 */
  enabled?: boolean;
}

interface UseSpotifyPollingReturn {
  /** 현재 재생 정보 */
  data: NowPlaying | null;
  /** 이전 재생 정보 (전환 애니메이션용) */
  previousData: NowPlaying | null;
  /** 로딩 상태 */
  isLoading: boolean;
  /** 에러 */
  error: Error | undefined;
  /** 곡이 변경되었는지 여부 */
  hasTrackChanged: boolean;
  /** 재생 상태가 변경되었는지 여부 */
  hasPlayStateChanged: boolean;
  /** 변경 상태 리셋 (애니메이션 완료 후 호출) */
  resetChangeState: () => void;
}

const fetcher = async (url: string): Promise<NowPlayingResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch now playing');
  }
  return response.json();
};

/**
 * Spotify 재생 정보를 폴링하는 커스텀 훅
 *
 * 특징:
 * - Adaptive polling: 재생 중일 때 더 자주 폴링
 * - Visibility API: 탭 비활성 시 폴링 중단
 * - 상태 변화 감지: 곡 변경, 재생 상태 변경 추적
 */
export function useSpotifyPolling({
  initialData,
  playingInterval = 5000,
  pausedInterval = 30000,
  enabled = true,
}: UseSpotifyPollingOptions = {}): UseSpotifyPollingReturn {
  const [isVisible, setIsVisible] = useState(true);
  const [previousData, setPreviousData] = useState<NowPlaying | null>(null);
  const [hasTrackChanged, setHasTrackChanged] = useState(false);
  const [hasPlayStateChanged, setHasPlayStateChanged] = useState(false);

  // 이전 데이터 참조 (비교용)
  const lastDataRef = useRef<NowPlaying | null>(initialData ?? null);

  // Visibility API 처리
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // 현재 재생 상태에 따른 폴링 간격 계산
  const getRefreshInterval = useCallback(
    (latestData: NowPlayingResponse | undefined): number => {
      if (!enabled || !isVisible) return 0;
      const isPlaying = latestData?.data?.isPlaying ?? initialData?.isPlaying ?? false;
      return isPlaying ? playingInterval : pausedInterval;
    },
    [enabled, isVisible, playingInterval, pausedInterval, initialData?.isPlaying]
  );

  const {
    data: response,
    error,
    isLoading,
  } = useSWR<NowPlayingResponse>(enabled ? '/api/spotify/now-playing' : null, fetcher, {
    fallbackData: initialData ? { data: initialData, timestamp: Date.now() } : undefined,
    refreshInterval: getRefreshInterval,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 2000,
    // 데이터 비교로 불필요한 리렌더링 방지
    compare: (a, b) => {
      if (!a?.data && !b?.data) return true;
      if (!a?.data || !b?.data) return false;
      return (
        a.data.songUrl === b.data.songUrl && a.data.isPlaying === b.data.isPlaying && a.data.title === b.data.title
      );
    },
  });

  const currentData = response?.data ?? initialData ?? null;

  // 상태 변화 감지
  useEffect(() => {
    const lastData = lastDataRef.current;

    if (!currentData) {
      lastDataRef.current = null;
      return;
    }

    // 곡 변경 감지 (songUrl로 비교)
    if (lastData && lastData.songUrl !== currentData.songUrl) {
      setPreviousData(lastData);
      setHasTrackChanged(true);
    }

    // 재생 상태 변경 감지
    if (lastData && lastData.isPlaying !== currentData.isPlaying) {
      setHasPlayStateChanged(true);
    }

    lastDataRef.current = currentData;
  }, [currentData]);

  const resetChangeState = useCallback(() => {
    setHasTrackChanged(false);
    setHasPlayStateChanged(false);
    setPreviousData(null);
  }, []);

  return {
    data: currentData,
    previousData,
    isLoading: isLoading && !initialData,
    error,
    hasTrackChanged,
    hasPlayStateChanged,
    resetChangeState,
  };
}
