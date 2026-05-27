import crypto from 'crypto';
import { NextResponse } from 'next/server';

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SCOPES = ['user-read-currently-playing', 'user-read-recently-played', 'user-read-playback-state'];

// CSRF 방지를 위한 state 생성
function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}

export async function GET(request: Request) {
  const host = request.headers.get('host') || '';
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';

  // localhost로 접속하면 127.0.0.1로 리다이렉트 (쿠키 도메인 일치를 위해)
  if (host.startsWith('localhost')) {
    const port = host.split(':')[1] || '3000';
    const redirectUrl = `${protocol}://127.0.0.1:${port}/api/spotify/login`;
    return NextResponse.redirect(redirectUrl);
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json({ error: 'SPOTIFY_CLIENT_ID가 설정되지 않았습니다.' }, { status: 500 });
  }

  const origin = `${protocol}://${host}`;
  const redirectUri = `${origin}/api/spotify/callback`;
  const state = generateState();

  // Authorization Code Flow (client_secret 사용) - PKCE 없이
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: SCOPES.join(' '),
    state,
  });

  const authUrl = `${SPOTIFY_AUTH_URL}?${params.toString()}`;

  // state를 쿠키에 저장 (CSRF 방지)
  const response = NextResponse.redirect(authUrl);
  response.cookies.set('spotify_auth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10분
  });

  return response;
}
