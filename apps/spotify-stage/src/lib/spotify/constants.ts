/** Spotify OAuth + Web API 엔드포인트와 설정 상수. */

export const SPOTIFY_AUTHORIZE_ENDPOINT = 'https://accounts.spotify.com/authorize';
export const SPOTIFY_TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
export const SPOTIFY_PLAYER_ENDPOINT = 'https://api.spotify.com/v1/me/player';

/**
 * - user-read-playback-state: device 포함 전체 player 상태 + 큐 읽기
 * - user-read-currently-playing: 현재 곡
 * - user-read-recently-played: Just Played(최근 재생)
 * - user-modify-playback-state: 재생 조작(next/prev/play/pause/shuffle/repeat). Premium 필요.
 */
export const SPOTIFY_SCOPES = [
  'user-read-playback-state',
  'user-read-currently-playing',
  'user-read-recently-played',
  'user-modify-playback-state',
] as const;

/** 공개 클라이언트(PKCE)라 client_secret 없이 client_id 만 사용한다. */
export const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '';

/**
 * redirect_uri 는 Spotify 대시보드에 등록한 값과 정확히 일치해야 한다.
 * 미지정 시 현재 origin 을 사용한다(로컬/프리뷰/프로덕션 모두 동일 코드로 동작).
 */
export const SPOTIFY_REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI ?? `${window.location.origin}/`;

/** access token 을 만료 60초 전에 미리 갱신하기 위한 버퍼. */
export const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;
