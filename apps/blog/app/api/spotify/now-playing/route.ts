import { NextResponse } from 'next/server';

import { getNowPlaying, type NowPlaying } from '@/src/entities/spotify';

export interface NowPlayingResponse {
  data: NowPlaying | null;
  timestamp: number;
}

/**
 * 재생 중 응답은 진행률·디바이스·일시정지 등 모든 변화를 실시간으로 흘려보내야 해서 캐시하지 않는다.
 * 일시정지/lastPlayed fallback 응답은 변동이 거의 없으므로 적극적으로 edge 캐시 → 동시 접속자 간 dedupe.
 * 데이터 자체가 없으면(API/네트워크 오류) 캐시하지 않아 다음 폴이 바로 재시도하게 둔다.
 */
const NO_CACHE = 'no-store, no-cache, must-revalidate';
const PAUSED_CACHE = 'public, s-maxage=30, stale-while-revalidate=120';
const LAST_PLAYED_CACHE = 'public, s-maxage=60, stale-while-revalidate=300';

function pickCacheControl(data: NowPlaying | null): string {
  if (!data) return NO_CACHE;
  if (data.isPlaying) return NO_CACHE;
  // isPlaying=false 인 응답 중 device 가 있으면 "방금 일시정지", 없으면 recently-played fallback
  return data.device ? PAUSED_CACHE : LAST_PLAYED_CACHE;
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
