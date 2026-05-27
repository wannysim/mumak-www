import { NextResponse } from 'next/server';

import { getNowPlaying, type NowPlaying } from '@/src/entities/spotify';

export interface NowPlayingResponse {
  data: NowPlaying | null;
  timestamp: number;
}

// 재생 중 응답은 edge 캐시하지 않는다. Spotify currently-playing API 자체가 서버측에서 ~수십 초 캐시되기 때문에,
// edge 가 stale-while-revalidate 로 "playing" 을 한 번 더 잡아두면 외부에서 일시정지를 눌렀을 때
// 클라이언트가 paused 를 인지하기까지 지연이 누적된다. 동시 폴링 dedupe 는 클라이언트 SWR(dedupingInterval) 이 처리.
// 일시정지/lastPlayed fallback 응답은 변동이 거의 없으므로 적극적으로 캐시.
// 데이터 자체가 없으면(API/네트워크 오류) 캐시하지 않아 다음 폴이 바로 재시도하게 둔다.
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
