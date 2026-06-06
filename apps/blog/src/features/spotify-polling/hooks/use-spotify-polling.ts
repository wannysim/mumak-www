import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import useSWR from 'swr';

import type { NowPlaying } from '@/src/entities/spotify';

interface NowPlayingResponse {
  data: NowPlaying | null;
  timestamp: number;
}

interface UseSpotifyPollingOptions {
  /** 초기 데이터 (SSR에서 전달) */
  initialData?: NowPlaying | null;
  /** 재생 중일 때 기본 폴링 간격 (ms). 곡 잔여 시간을 모를 때 fallback. */
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
  /** 최신 데이터를 받은 시각 (ms epoch). 진행률 보간의 baseline 으로 사용. */
  fetchedAt: number;
}

const fetcher = async (url: string): Promise<NowPlayingResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch now playing');
  }
  return response.json();
};

function subscribeVisibility(onStoreChange: () => void) {
  document.addEventListener('visibilitychange', onStoreChange);
  return () => document.removeEventListener('visibilitychange', onStoreChange);
}

function useDocumentVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === 'visible',
    () => true
  );
}

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
  const isVisible = useDocumentVisible();
  const [previousData, setPreviousData] = useState<NowPlaying | null>(null);
  const [hasPlayStateChanged, setHasPlayStateChanged] = useState(false);

  // 재생 중이면 playingInterval, 그 외엔 pausedInterval. 트랙 종료 시점은 별도 useEffect 의 예측 fetch 가 잡는다.
  const getRefreshInterval = useCallback(
    (latestData: NowPlayingResponse | undefined): number => {
      if (!enabled || !isVisible) return 0;
      const current = latestData?.data ?? initialData ?? null;
      if (!current?.isPlaying) return pausedInterval;
      return playingInterval;
    },
    [enabled, isVisible, playingInterval, pausedInterval, initialData]
  );

  const {
    data: response,
    error,
    isLoading,
    mutate,
  } = useSWR<NowPlayingResponse>(enabled ? '/api/spotify/now-playing' : null, fetcher, {
    fallbackData: initialData ? { data: initialData, timestamp: Date.now() } : undefined,
    refreshInterval: getRefreshInterval,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 500,
    // 기본 deep-equal 비교 사용: progressMs/device 등 모든 필드의 변화를 감지해야
    // 구간 점프·디바이스 전환을 즉시 반영할 수 있다.
  });

  const currentData = response?.data ?? initialData ?? null;
  const fetchedAt = response?.timestamp ?? 0;

  // 트랙 종료 예측 fetch: 보간된 잔여 시간이 0이 되는 정확한 시점에
  // mutate 를 트리거해서 다음 폴 간격을 기다리지 않고 즉시 새 트랙을 가져온다.
  useEffect(() => {
    if (!enabled || !isVisible) return;
    if (!currentData?.isPlaying) return;
    if (currentData.progressMs == null || currentData.durationMs == null) return;
    if (!fetchedAt) return;

    const elapsed = Math.max(0, Date.now() - fetchedAt);
    const remainingMs = currentData.durationMs - currentData.progressMs - elapsed;
    if (remainingMs <= 0) return;

    const timerId = window.setTimeout(() => {
      mutate().catch(() => {
        // 실패하면 다음 polling tick 에 맡긴다
      });
    }, remainingMs);

    return () => window.clearTimeout(timerId);
  }, [enabled, isVisible, currentData, fetchedAt, mutate]);

  // 상태 변화 감지: useEffect 대신 render 중 prev 비교로 조정한다.
  // effect 경유는 "변경 전 상태"로 한 프레임을 먼저 그린 뒤 다시 그리지만,
  // render 중 조정은 React가 커밋 전에 즉시 재렌더해 중간 프레임이 없다.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [lastSeen, setLastSeen] = useState<NowPlaying | null>(initialData ?? null);
  if (currentData !== lastSeen) {
    setLastSeen(currentData);
    if (currentData && lastSeen) {
      // 곡 변경 감지 (songUrl로 비교)
      if (lastSeen.songUrl !== currentData.songUrl) {
        setPreviousData(lastSeen);
      }
      // 재생 상태 변경 감지
      if (lastSeen.isPlaying !== currentData.isPlaying) {
        setHasPlayStateChanged(true);
      }
    }
  }

  // 곡 변경 플래그는 previousData 존재 여부에서 파생된다 (중복 상태 제거).
  const hasTrackChanged = previousData !== null;

  const resetChangeState = useCallback(() => {
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
    fetchedAt,
  };
}
