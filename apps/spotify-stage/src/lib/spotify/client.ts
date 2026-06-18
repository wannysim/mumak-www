/** Spotify Web API 의 /me/player 를 호출해 NowPlaying 으로 정규화한다. */

import { SPOTIFY_PLAYER_ENDPOINT } from './constants';
import { KNOWN_DEVICE_TYPES, type NowPlaying, type SpotifyDeviceInfo, type SpotifyDeviceType } from './types';

interface SpotifyArtist {
  name: string;
}

interface SpotifyTrack {
  name: string;
  artists: SpotifyArtist[];
  album: { name: string; images: Array<{ url: string }> };
  explicit: boolean;
  duration_ms: number;
  external_urls: { spotify: string };
}

interface SpotifyDevice {
  name: string;
  type: string;
  volume_percent: number | null;
}

interface SpotifyPlayerResponse {
  is_playing: boolean;
  item: SpotifyTrack | null;
  progress_ms: number | null;
  device?: SpotifyDevice;
}

/** 401(토큰 만료) 을 호출부가 구분할 수 있도록 별도 결과로 표현한다. */
export type NowPlayingResult =
  | { kind: 'ok'; data: NowPlaying }
  | { kind: 'empty' }
  | { kind: 'unauthorized' }
  | { kind: 'error' };

function normalizeDevice(device: SpotifyDevice | undefined): SpotifyDeviceInfo | null {
  if (!device?.name) {
    return null;
  }
  const type: SpotifyDeviceType = KNOWN_DEVICE_TYPES.has(device.type as SpotifyDeviceType)
    ? (device.type as SpotifyDeviceType)
    : 'Unknown';
  return { name: device.name, type, volumePercent: device.volume_percent ?? null };
}

function toNowPlaying(response: SpotifyPlayerResponse): NowPlaying | null {
  const track = response.item;
  if (!track) {
    return null;
  }
  return {
    isPlaying: response.is_playing,
    title: track.name,
    artist: track.artists.map(artist => artist.name).join(', '),
    album: track.album.name,
    albumImageUrl: track.album.images[0]?.url ?? '',
    songUrl: track.external_urls.spotify,
    isExplicit: track.explicit,
    progressMs: response.progress_ms ?? null,
    durationMs: track.duration_ms ?? null,
    device: normalizeDevice(response.device),
  };
}

export async function fetchNowPlaying(accessToken: string): Promise<NowPlayingResult> {
  let response: Response;
  try {
    response = await fetch(SPOTIFY_PLAYER_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
  } catch {
    return { kind: 'error' };
  }

  if (response.status === 401) {
    return { kind: 'unauthorized' };
  }

  // 204 = 활성 디바이스 없음(아무것도 재생 중이지 않음)
  if (response.status === 204) {
    return { kind: 'empty' };
  }

  if (!response.ok) {
    return { kind: 'error' };
  }

  try {
    const json = (await response.json()) as SpotifyPlayerResponse;
    const data = toNowPlaying(json);
    return data ? { kind: 'ok', data } : { kind: 'empty' };
  } catch {
    return { kind: 'error' };
  }
}
