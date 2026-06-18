import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { getValidAccessToken } from '@/lib/spotify/auth';
import { fetchNowPlaying } from '@/lib/spotify/client';
import type { NowPlaying } from '@/lib/spotify/types';

interface UseNowPlayingOptions {
  /** 재생 중 폴링 간격(ms). */
  playingInterval?: number;
  /** 일시정지/유휴 시 폴링 간격(ms). */
  idleInterval?: number;
  /** 폴링 활성화 여부. */
  enabled?: boolean;
}

interface UseNowPlayingReturn {
  data: NowPlaying | null;
  isLoading: boolean;
  /** 'unauthorized' 가 두 번 연속이면 토큰 폐기로 간주. */
  needsReauth: boolean;
  /** 마지막으로 데이터를 받은 시각(epoch ms). 진행률 보간 baseline. */
  fetchedAt: number;
}

function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

function useDocumentVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === 'visible',
    () => true
  );
}

/**
 * /me/player 를 적응형 간격으로 폴링한다.
 * - 재생 중엔 자주, 유휴/일시정지엔 느리게
 * - 탭이 백그라운드면 폴링 중단(visibilitychange)
 * - 401 시 토큰 갱신 후 1회 재시도
 */
export function useNowPlaying({
  playingInterval = 5000,
  idleInterval = 30000,
  enabled = true,
}: UseNowPlayingOptions = {}): UseNowPlayingReturn {
  const isVisible = useDocumentVisible();
  const [data, setData] = useState<NowPlaying | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(0);

  // 최신 isPlaying 을 effect 재실행 없이 참조하기 위한 ref.
  const isPlayingRef = useRef(false);
  isPlayingRef.current = data?.isPlaying ?? false;

  const poll = useCallback(async (): Promise<void> => {
    const token = await getValidAccessToken();
    if (!token) {
      setNeedsReauth(true);
      setIsLoading(false);
      return;
    }

    let result = await fetchNowPlaying(token);

    if (result.kind === 'unauthorized') {
      const refreshed = await getValidAccessToken();
      if (!refreshed) {
        setNeedsReauth(true);
        setIsLoading(false);
        return;
      }
      result = await fetchNowPlaying(refreshed);
    }

    setIsLoading(false);

    if (result.kind === 'ok') {
      setData(result.data);
      setFetchedAt(Date.now());
    } else if (result.kind === 'empty') {
      setData(null);
      setFetchedAt(Date.now());
    } else if (result.kind === 'unauthorized') {
      setNeedsReauth(true);
    }
    // 'error' 는 직전 데이터를 유지하고 다음 tick 에 재시도한다.
  }, []);

  useEffect(() => {
    if (!enabled || !isVisible) {
      return;
    }

    let stopped = false;
    let timerId: number | undefined;

    const tick = async () => {
      if (stopped) {
        return;
      }
      await poll();
      if (stopped) {
        return;
      }
      const interval = isPlayingRef.current ? playingInterval : idleInterval;
      timerId = window.setTimeout(tick, interval);
    };

    tick();

    return () => {
      stopped = true;
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
      }
    };
  }, [enabled, isVisible, poll, playingInterval, idleInterval]);

  return { data, isLoading, needsReauth, fetchedAt };
}
