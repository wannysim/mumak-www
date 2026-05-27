import { NextResponse } from 'next/server';

import { getNowPlaying, type NowPlaying } from '@/src/entities/spotify';

export interface NowPlayingResponse {
  data: NowPlaying | null;
  timestamp: number;
}

const EDGE_CACHE_MAX_AGE_S = 10;
const EDGE_CACHE_SWR_S = 30;

export async function GET(): Promise<NextResponse<NowPlayingResponse>> {
  const data = await getNowPlaying();

  return NextResponse.json(
    {
      data,
      timestamp: Date.now(),
    },
    {
      headers: {
        'Cache-Control': `public, s-maxage=${EDGE_CACHE_MAX_AGE_S}, stale-while-revalidate=${EDGE_CACHE_SWR_S}`,
      },
    }
  );
}
