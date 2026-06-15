import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token: string;
}

// refresh token을 담은 응답은 브라우저/프록시 캐시에 남거나 이후 navigation의
// Referer로 새면 안 된다. 토큰 교환 실패 응답에도 동일하게 적용해 보수적으로 막는다.
const NO_STORE_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store, private',
  Pragma: 'no-cache',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex',
};

function harden(res: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(NO_STORE_HEADERS)) {
    res.headers.set(key, value);
  }
  return res;
}

// state 쿠키를 1회 소비해 같은 콜백 URL 재사용(replay)을 차단한다.
// state 검증을 통과한 이후의 모든 응답 경로(성공/토큰 실패/env 누락/예외)에서 호출한다.
function finalizeAfterStateCheck(res: NextResponse): NextResponse {
  res.cookies.delete('spotify_auth_state');
  return harden(res);
}

// OAuth 콜백은 GET이 표준이며 CSRF는 state 파라미터-쿠키 대조로 방어한다.
// authorization code는 Spotify 측에서 일회성이라 prefetch로 재실행돼도 부작용이 없다.
// 이 route는 no-store + state single-use로 토큰 노출 위험을 추가로 보강한다.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return harden(NextResponse.json({ error: `Spotify 인증 실패: ${error}` }, { status: 400 }));
  }

  if (!code) {
    return harden(NextResponse.json({ error: 'Authorization code가 없습니다.' }, { status: 400 }));
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get('spotify_auth_state')?.value;

  if (!storedState || storedState !== state) {
    return harden(
      NextResponse.json({ error: 'State 불일치. /api/spotify/login부터 다시 시작해주세요.' }, { status: 400 })
    );
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return finalizeAfterStateCheck(
      NextResponse.json(
        { error: 'SPOTIFY_CLIENT_ID 또는 SPOTIFY_CLIENT_SECRET이 설정되지 않았습니다.' },
        { status: 500 }
      )
    );
  }

  const host = request.headers.get('host') || '';
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const origin = `${protocol}://${host}`;
  const redirectUri = `${origin}/api/spotify/callback`;

  // Authorization Code Flow - client_secret 사용
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      // 토큰 교환 응답은 절대 캐시되면 안 된다.
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[Spotify] 토큰 발급 실패:', response.status, errorData);
      return finalizeAfterStateCheck(
        NextResponse.json({ error: '토큰 발급 실패', details: errorData }, { status: response.status })
      );
    }

    const data = (await response.json()) as SpotifyTokenResponse;

    // refresh_token을 화면에 표시
    const html = `
      <!DOCTYPE html>
      <html lang="ko">
        <head>
          <meta charset="utf-8">
          <title>Spotify 인증 완료</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 800px;
              margin: 50px auto;
              padding: 20px;
              background: #1a1a1a;
              color: #fff;
            }
            h1 { color: #1DB954; }
            .token-box {
              background: #282828;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
              word-break: break-all;
            }
            .token-label {
              color: #b3b3b3;
              font-size: 14px;
              margin-bottom: 8px;
            }
            .token-value {
              font-family: monospace;
              font-size: 14px;
              color: #1DB954;
              user-select: all;
            }
            .instructions {
              background: #282828;
              padding: 20px;
              border-radius: 8px;
              margin-top: 30px;
            }
            code {
              background: #404040;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 13px;
            }
          </style>
        </head>
        <body>
          <h1>Spotify 인증 완료!</h1>
          <p>아래 refresh token을 복사해서 <code>.env.local</code> 파일에 추가하세요.</p>

          <div class="token-box">
            <div class="token-label">SPOTIFY_REFRESH_TOKEN</div>
            <div class="token-value">${data.refresh_token}</div>
          </div>

          <div class="instructions">
            <h3>.env.local 설정 예시</h3>
            <pre><code>SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REFRESH_TOKEN=${data.refresh_token}</code></pre>
          </div>

          <p style="margin-top: 30px; color: #b3b3b3;">
            이 토큰은 일회성으로 표시됩니다. 페이지를 새로고침하면 다시 볼 수 없으니 반드시 복사해두세요.
          </p>
        </body>
      </html>
    `;

    return finalizeAfterStateCheck(
      new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    );
  } catch (err) {
    console.error('[Spotify] 토큰 요청 중 예외:', err);
    return finalizeAfterStateCheck(NextResponse.json({ error: '토큰 요청 중 오류 발생' }, { status: 500 }));
  }
}
