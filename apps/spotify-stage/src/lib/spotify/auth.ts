/**
 * Spotify Authorization Code + PKCE 플로우 (백엔드 없음).
 * - login(): authorize 엔드포인트로 리다이렉트
 * - handleRedirectCallback(): ?code= 를 토큰으로 교환
 * - getValidAccessToken(): 캐시된 토큰 반환, 만료 시 refresh
 */

import {
  SPOTIFY_AUTHORIZE_ENDPOINT,
  SPOTIFY_CLIENT_ID,
  SPOTIFY_REDIRECT_URI,
  SPOTIFY_SCOPES,
  SPOTIFY_TOKEN_ENDPOINT,
  TOKEN_EXPIRY_BUFFER_MS,
} from './constants';
import { deriveCodeChallenge, generateCodeVerifier, generateState } from './pkce';

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  /** epoch ms */
  expiresAt: number;
}

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

const TOKENS_KEY = 'spotify-stage:tokens';
const VERIFIER_KEY = 'spotify-stage:pkce-verifier';
const STATE_KEY = 'spotify-stage:oauth-state';

function readTokens(): StoredTokens | null {
  const raw = localStorage.getItem(TOKENS_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as StoredTokens;
  } catch {
    return null;
  }
}

function writeTokens(tokens: StoredTokens): void {
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

export function clearSession(): void {
  localStorage.removeItem(TOKENS_KEY);
  localStorage.removeItem(VERIFIER_KEY);
  localStorage.removeItem(STATE_KEY);
}

export function isAuthenticated(): boolean {
  return readTokens() !== null;
}

export function hasClientId(): boolean {
  return SPOTIFY_CLIENT_ID.length > 0;
}

/** authorize 엔드포인트로 리다이렉트해 사용자 동의를 받는다. */
export async function login(): Promise<void> {
  const verifier = generateCodeVerifier();
  const challenge = await deriveCodeChallenge(verifier);
  const state = generateState();

  localStorage.setItem(VERIFIER_KEY, verifier);
  localStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: SPOTIFY_REDIRECT_URI,
    scope: SPOTIFY_SCOPES.join(' '),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  });

  window.location.assign(`${SPOTIFY_AUTHORIZE_ENDPOINT}?${params.toString()}`);
}

function persistTokenResponse(data: SpotifyTokenResponse, fallbackRefreshToken?: string): void {
  writeTokens({
    accessToken: data.access_token,
    // refresh_token 은 갱신 응답에서 생략될 수 있으므로 기존 값을 유지한다.
    refreshToken: data.refresh_token ?? fallbackRefreshToken ?? '',
    expiresAt: Date.now() + data.expires_in * 1000,
  });
}

/**
 * 리다이렉트 복귀 시 URL 의 ?code= 를 토큰으로 교환한다.
 * @returns 처리 결과. 'authenticated' | 'no-code' | 'error'
 */
export async function handleRedirectCallback(): Promise<'authenticated' | 'no-code' | 'error'> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const authError = url.searchParams.get('error');

  if (authError) {
    clearSession();
    cleanUrl(url);
    return 'error';
  }

  if (!code) {
    return 'no-code';
  }

  const verifier = localStorage.getItem(VERIFIER_KEY);
  const expectedState = localStorage.getItem(STATE_KEY);

  // state 불일치(CSRF)거나 verifier 분실 시 교환을 거부한다.
  if (!verifier || !returnedState || returnedState !== expectedState) {
    cleanUrl(url);
    return 'error';
  }

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    code_verifier: verifier,
  });

  try {
    const response = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      clearSession();
      cleanUrl(url);
      return 'error';
    }

    const data = (await response.json()) as SpotifyTokenResponse;
    persistTokenResponse(data);
    localStorage.removeItem(VERIFIER_KEY);
    localStorage.removeItem(STATE_KEY);
    cleanUrl(url);
    return 'authenticated';
  } catch {
    cleanUrl(url);
    return 'error';
  }
}

/** code/state 쿼리를 주소창에서 제거해 새로고침 시 재교환을 막는다. */
function cleanUrl(url: URL): void {
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  url.searchParams.delete('error');
  window.history.replaceState({}, '', url.pathname + url.search + url.hash);
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  try {
    const response = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      // refresh token 이 폐기됐으면 세션을 비워 재로그인을 유도한다.
      clearSession();
      return null;
    }

    const data = (await response.json()) as SpotifyTokenResponse;
    persistTokenResponse(data, refreshToken);
    return data.access_token;
  } catch {
    return null;
  }
}

/** 유효한 access token 을 반환한다. 만료 임박 시 refresh 한다. */
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = readTokens();
  if (!tokens) {
    return null;
  }

  if (Date.now() < tokens.expiresAt - TOKEN_EXPIRY_BUFFER_MS) {
    return tokens.accessToken;
  }

  if (!tokens.refreshToken) {
    clearSession();
    return null;
  }

  return refreshAccessToken(tokens.refreshToken);
}
