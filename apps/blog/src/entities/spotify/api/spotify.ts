import { connection } from 'next/server';

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

interface SpotifyArtist {
  name: string;
}

interface SpotifyAlbum {
  name: string;
  images: Array<{ url: string }>;
}

interface SpotifyTrack {
  name: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  explicit: boolean;
  duration_ms: number;
  external_urls: {
    spotify: string;
  };
}

export type SpotifyDeviceType =
  | 'Computer'
  | 'Smartphone'
  | 'Speaker'
  | 'TV'
  | 'Tablet'
  | 'AVR'
  | 'STB'
  | 'AudioDongle'
  | 'GameConsole'
  | 'CastVideo'
  | 'CastAudio'
  | 'Automobile'
  | 'Unknown';

interface SpotifyDevice {
  name: string;
  type: string;
  is_active: boolean;
}

interface SpotifyCurrentlyPlayingResponse {
  is_playing: boolean;
  item: SpotifyTrack;
  progress_ms: number | null;
  device?: SpotifyDevice;
}

interface SpotifyRecentlyPlayedResponse {
  items: Array<{
    track: SpotifyTrack;
    played_at: string;
  }>;
}

export interface SpotifyDeviceInfo {
  name: string;
  type: SpotifyDeviceType;
}

export interface NowPlaying {
  isPlaying: boolean;
  title: string;
  artist: string;
  album: string;
  albumImageUrl: string;
  songUrl: string;
  isExplicit: boolean;
  progressMs: number | null;
  durationMs: number | null;
  device: SpotifyDeviceInfo | null;
}

const KNOWN_DEVICE_TYPES: ReadonlySet<SpotifyDeviceType> = new Set([
  'Computer',
  'Smartphone',
  'Speaker',
  'TV',
  'Tablet',
  'AVR',
  'STB',
  'AudioDongle',
  'GameConsole',
  'CastVideo',
  'CastAudio',
  'Automobile',
  'Unknown',
]);

function normalizeDevice(device: SpotifyDevice | undefined): SpotifyDeviceInfo | null {
  if (!device?.name) {
    return null;
  }
  const type = KNOWN_DEVICE_TYPES.has(device.type as SpotifyDeviceType)
    ? (device.type as SpotifyDeviceType)
    : 'Unknown';
  return { name: device.name, type };
}

const NOW_PLAYING_ENDPOINT = 'https://api.spotify.com/v1/me/player';
const RECENTLY_PLAYED_ENDPOINT = 'https://api.spotify.com/v1/me/player/recently-played?limit=1';
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';

// 토큰 만료 5분 전에 갱신하도록 버퍼 설정
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

// 메모리 기반 토큰 캐시
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

async function fetchNewToken(): Promise<{ token: string; expiresIn: number } | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    console.error('[Spotify] 환경 변수 누락:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasRefreshToken: !!refreshToken,
    });
    return null;
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[Spotify] 토큰 갱신 실패:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      return null;
    }

    const data = (await response.json()) as SpotifyTokenResponse;
    return { token: data.access_token, expiresIn: data.expires_in };
  } catch (error) {
    console.error('[Spotify] 토큰 요청 중 예외 발생:', error);
    return null;
  }
}

async function getAccessToken(forceRefresh = false): Promise<string | null> {
  const now = Date.now();

  // 캐시된 토큰이 유효하고 강제 갱신이 아닌 경우 캐시 사용
  if (!forceRefresh && cachedToken && now < tokenExpiresAt - TOKEN_EXPIRY_BUFFER_MS) {
    return cachedToken;
  }

  const result = await fetchNewToken();
  if (!result) {
    return null;
  }

  cachedToken = result.token;
  tokenExpiresAt = now + result.expiresIn * 1000;

  return cachedToken;
}

function invalidateTokenCache(): void {
  cachedToken = null;
  tokenExpiresAt = 0;
}

// 테스트에서 토큰 캐시를 초기화하기 위한 함수
export function __resetTokenCacheForTesting(): void {
  cachedToken = null;
  tokenExpiresAt = 0;
}

async function fetchNowPlayingData(accessToken: string): Promise<NowPlaying | null | 'UNAUTHORIZED'> {
  const response = await fetch(NOW_PLAYING_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  // 401 에러 시 토큰 갱신 필요
  if (response.status === 401) {
    return 'UNAUTHORIZED';
  }

  if (response.status === 204 || response.status > 400) {
    if (response.status > 400) {
      const errorData = await response.text();
      console.error('[Spotify] 현재 재생 중 API 에러:', {
        status: response.status,
        error: errorData,
      });
    }

    const recentlyPlayed = await fetch(RECENTLY_PLAYED_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    });

    // 401 에러 시 토큰 갱신 필요
    if (recentlyPlayed.status === 401) {
      return 'UNAUTHORIZED';
    }

    if (recentlyPlayed.status !== 200) {
      const errorData = await recentlyPlayed.text();
      console.error('[Spotify] 최근 재생 API 에러:', {
        status: recentlyPlayed.status,
        error: errorData,
      });
      return null;
    }

    const data = (await recentlyPlayed.json()) as SpotifyRecentlyPlayedResponse;

    if (!data.items || data.items.length === 0) {
      console.log('[Spotify] 최근 재생 목록이 비어있음');
      return null;
    }

    const firstItem = data.items[0];
    if (!firstItem) {
      return null;
    }

    const track = firstItem.track;

    return {
      isPlaying: false,
      title: track.name,
      artist: track.artists.map(artist => artist.name).join(', '),
      album: track.album.name,
      albumImageUrl: track.album.images[0]?.url || '',
      songUrl: track.external_urls.spotify,
      isExplicit: track.explicit,
      progressMs: null,
      durationMs: null,
      device: null,
    };
  }

  const song = (await response.json()) as SpotifyCurrentlyPlayingResponse;

  return {
    isPlaying: song.is_playing,
    title: song.item.name,
    artist: song.item.artists.map(artist => artist.name).join(', '),
    album: song.item.album.name,
    albumImageUrl: song.item.album.images[0]?.url || '',
    songUrl: song.item.external_urls.spotify,
    isExplicit: song.item.explicit,
    progressMs: song.progress_ms ?? null,
    durationMs: song.item.duration_ms ?? null,
    device: normalizeDevice(song.device),
  };
}

/**
 * Spotify API 직접 호출 (캐싱 없음)
 * - 'use cache' 컴포넌트 내에서 호출됨
 * - connection() 호출 불필요 (캐시 컴포넌트가 처리)
 */
export async function getNowPlayingDirect(): Promise<NowPlaying | null> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    console.error('[Spotify] Access token을 가져올 수 없음');
    return null;
  }

  try {
    const result = await fetchNowPlayingData(accessToken);

    // 401 에러 발생 시 토큰 강제 갱신 후 재시도
    if (result === 'UNAUTHORIZED') {
      console.log('[Spotify] 토큰 만료 감지, 새 토큰으로 재시도');
      invalidateTokenCache();

      const newAccessToken = await getAccessToken(true);
      if (!newAccessToken) {
        console.error('[Spotify] 토큰 갱신 후에도 Access token을 가져올 수 없음');
        return null;
      }

      const retryResult = await fetchNowPlayingData(newAccessToken);
      if (retryResult === 'UNAUTHORIZED') {
        console.error('[Spotify] 토큰 갱신 후에도 401 에러 발생');
        return null;
      }
      return retryResult;
    }

    return result;
  } catch (error) {
    console.error('[Spotify] API 호출 중 예외 발생:', error);
    return null;
  }
}

/**
 * Spotify 재생 정보 조회 (Route Handler용)
 * - API route에서 호출 시 사용
 * - connection()으로 동적 렌더링 전환
 */
export async function getNowPlaying(): Promise<NowPlaying | null> {
  // 동적 렌더링으로 전환 (Date.now() 사용 전에 호출 필요)
  // PPR 모드에서 prerendering 완료 후 connection()이 reject될 수 있음
  try {
    await connection();
  } catch (error) {
    // HANGING_PROMISE_REJECTION은 PPR 빌드 시 예상되는 동작이므로 무시
    if (error instanceof Error && error.message.includes('prerender')) {
      return null;
    }
    throw error;
  }

  return getNowPlayingDirect();
}
