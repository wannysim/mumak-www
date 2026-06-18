import { useEffect, useState } from 'react';

import { fetchJustPlayed, fetchUpNext } from '@/lib/spotify/playback';
import type { TrackBrief } from '@/lib/spotify/types';

interface UseUpNextReturn {
  upNext: TrackBrief[];
  justPlayed: TrackBrief[];
  isLoading: boolean;
}

/**
 * 큐(다음 곡)와 최근 재생(이전 곡)을 가져온다.
 * enabled(패널 열림)일 때만 호출하고, 현재 곡(trackKey)이 바뀌면 다시 불러온다.
 */
export function useUpNext(trackKey: string | undefined, enabled: boolean): UseUpNextReturn {
  const [upNext, setUpNext] = useState<TrackBrief[]>([]);
  const [justPlayed, setJustPlayed] = useState<TrackBrief[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    Promise.all([fetchUpNext(), fetchJustPlayed()])
      .then(([queue, recent]) => {
        if (cancelled) {
          return;
        }
        setUpNext(queue);
        setJustPlayed(recent);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [trackKey, enabled]);

  return { upNext, justPlayed, isLoading };
}
