/**
 * 재생 조작(컨트롤)과 큐/최근 재생 조회.
 * 조작 엔드포인트는 user-modify-playback-state 스코프 + Premium 이 필요하다.
 */

import { getValidAccessToken } from './auth';
import type { RepeatState, TrackBrief } from './types';

const API_BASE = 'https://api.spotify.com/v1';

export type ControlResult =
  | { ok: true }
  // premium: Premium 계정 필요, scope: 권한(재로그인) 필요, no-device: 활성 기기 없음
  | { ok: false; reason: 'premium' | 'scope' | 'no-device' | 'auth' | 'error' };

async function sendCommand(method: 'POST' | 'PUT', path: string): Promise<ControlResult> {
  const token = await getValidAccessToken();
  if (!token) {
    return { ok: false, reason: 'auth' };
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return { ok: false, reason: 'error' };
  }

  if (response.ok || response.status === 204) {
    return { ok: true };
  }
  if (response.status === 404) {
    return { ok: false, reason: 'no-device' };
  }
  if (response.status === 401) {
    return { ok: false, reason: 'auth' };
  }
  if (response.status === 403) {
    // 403 은 권한 부족(스코프)과 Premium 미보유 둘 다 가능 → 본문 메시지로 구분.
    const body = await response.text().catch(() => '');
    return { ok: false, reason: /scope/i.test(body) ? 'scope' : 'premium' };
  }
  return { ok: false, reason: 'error' };
}

export const skipNext = () => sendCommand('POST', '/me/player/next');
export const skipPrevious = () => sendCommand('POST', '/me/player/previous');
export const resumePlayback = () => sendCommand('PUT', '/me/player/play');
export const pausePlayback = () => sendCommand('PUT', '/me/player/pause');
export const setShuffle = (state: boolean) => sendCommand('PUT', `/me/player/shuffle?state=${state}`);
export const setRepeat = (state: RepeatState) => sendCommand('PUT', `/me/player/repeat?state=${state}`);

interface RawTrack {
  name: string;
  artists?: Array<{ name: string }>;
  album?: { images?: Array<{ url: string }> };
  images?: Array<{ url: string }>;
  external_urls?: { spotify?: string };
}

function toBrief(track: RawTrack): TrackBrief {
  return {
    title: track.name,
    artist: (track.artists ?? []).map(a => a.name).join(', '),
    albumImageUrl: track.album?.images?.[0]?.url ?? track.images?.[0]?.url ?? '',
    songUrl: track.external_urls?.spotify ?? '',
  };
}

async function fetchTracks(path: string, pick: (json: unknown) => RawTrack[]): Promise<TrackBrief[]> {
  const token = await getValidAccessToken();
  if (!token) {
    return [];
  }
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!response.ok) {
      return [];
    }
    return pick(await response.json()).map(toBrief);
  } catch {
    return [];
  }
}

/** 다음 대기열(최대 limit 개). */
export function fetchUpNext(limit = 8): Promise<TrackBrief[]> {
  return fetchTracks('/me/player/queue', json => {
    const queue = (json as { queue?: RawTrack[] }).queue ?? [];
    return queue.slice(0, limit);
  });
}

/** 최근 재생(최신순). */
export function fetchJustPlayed(limit = 8): Promise<TrackBrief[]> {
  return fetchTracks(`/me/player/recently-played?limit=${limit}`, json => {
    const items = (json as { items?: Array<{ track: RawTrack }> }).items ?? [];
    return items.map(item => item.track);
  });
}
