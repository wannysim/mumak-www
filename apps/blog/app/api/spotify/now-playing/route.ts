import { NextResponse } from 'next/server';

import { getNowPlaying, type NowPlaying } from '@/src/entities/spotify';

export interface NowPlayingResponse {
  data: NowPlaying | null;
  timestamp: number;
}

/**
 * 클라이언트 폴링 간격(2~4s)에 맞춰 edge cache 도 짧게 잡는다.
 * 곡 종료가 임박할수록 캐시 윈도를 더 좁혀 트랙 전환·구간 점프를 빨리 노출한다.
 * 일시정지/데이터 없음 상태는 변동이 적어 더 긴 캐시 허용.
 */
const NEAR_END_CACHE = 'public, s-maxage=1, stale-while-revalidate=5';
const APPROACHING_END_CACHE = 'public, s-maxage=2, stale-while-revalidate=10';
const PLAYING_CACHE = 'public, s-maxage=3, stale-while-revalidate=15';
const PAUSED_CACHE = 'public, s-maxage=10, stale-while-revalidate=30';

function pickCacheControl(data: NowPlaying | null): string {
  if (!data?.isPlaying) return PAUSED_CACHE;
  if (data.progressMs == null || data.durationMs == null) return PLAYING_CACHE;

  const remainingMs = data.durationMs - data.progressMs;
  if (remainingMs < 10_000) return NEAR_END_CACHE;
  if (remainingMs < 30_000) return APPROACHING_END_CACHE;
  return PLAYING_CACHE;
}

export async function GET(): Promise<NextResponse<NowPlayingResponse>> {
  const data = await getNowPlaying();

  return NextResponse.json(
    {
      data,
      timestamp: Date.now(),
    },
    {
      headers: {
        'Cache-Control': pickCacheControl(data),
      },
    }
  );
}
