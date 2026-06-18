/** 아티스트 장르 조회 (energy 산출용). 카탈로그 엔드포인트라 추가 스코프 불필요. */

import { getValidAccessToken } from './auth';

const ARTIST_ENDPOINT = 'https://api.spotify.com/v1/artists';

// 같은 아티스트를 곡마다 다시 부르지 않도록 메모리 캐시.
const genreCache = new Map<string, string[]>();

export async function fetchArtistGenres(artistId: string): Promise<string[]> {
  const cached = genreCache.get(artistId);
  if (cached) {
    return cached;
  }

  const token = await getValidAccessToken();
  if (!token) {
    return [];
  }

  try {
    const response = await fetch(`${ARTIST_ENDPOINT}/${artistId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      return [];
    }
    const data = (await response.json()) as { genres?: string[] };
    const genres = data.genres ?? [];
    genreCache.set(artistId, genres);
    return genres;
  } catch {
    return [];
  }
}
