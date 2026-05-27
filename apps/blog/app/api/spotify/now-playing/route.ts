import { NextResponse } from 'next/server';

import { getNowPlaying, type NowPlaying } from '@/src/entities/spotify';

export interface NowPlayingResponse {
  data: NowPlaying | null;
  timestamp: number;
}

/** 곡 종료가 임박한 응답은 캐시를 짧게 잡아 트랙 전환을 빨리 노출. */
const NEAR_END_REMAINING_MS = 15_000;
const NEAR_END_CACHE = 'public, s-maxage=2, stale-while-revalidate=10';
const STEADY_CACHE = 'public, s-maxage=10, stale-while-revalidate=30';

function pickCacheControl(data: NowPlaying | null): string {
  if (!data?.isPlaying || data.progressMs == null || data.durationMs == null) {
    return STEADY_CACHE;
  }
  const remainingMs = data.durationMs - data.progressMs;
  return remainingMs < NEAR_END_REMAINING_MS ? NEAR_END_CACHE : STEADY_CACHE;
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
