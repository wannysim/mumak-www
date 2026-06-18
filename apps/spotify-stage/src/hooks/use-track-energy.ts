import { useEffect, useState } from 'react';

import type { Palette } from '@/lib/color/palette';
import { computeEnergy } from '@/lib/energy/energy';
import { fetchArtistGenres } from '@/lib/spotify/artist';
import type { NowPlaying } from '@/lib/spotify/types';

/**
 * 현재 곡의 energy(0~1) 를 산출한다.
 * 아티스트 장르는 비동기로 받아오고(캐시), 색·볼륨은 즉시 반영한다.
 * 볼륨/팔레트가 바뀌면(폴링) energy 도 따라 갱신된다.
 */
export function useTrackEnergy(nowPlaying: NowPlaying | null, palette: Palette): number {
  const [genres, setGenres] = useState<string[]>([]);
  const artistId = nowPlaying?.artistId ?? null;

  useEffect(() => {
    if (!artistId) {
      setGenres([]);
      return;
    }
    let cancelled = false;
    fetchArtistGenres(artistId).then(result => {
      if (!cancelled) {
        setGenres(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [artistId]);

  if (!nowPlaying) {
    return 0;
  }

  return computeEnergy({
    palette,
    volumePercent: nowPlaying.device?.volumePercent ?? null,
    genres,
    isExplicit: nowPlaying.isExplicit,
  });
}
