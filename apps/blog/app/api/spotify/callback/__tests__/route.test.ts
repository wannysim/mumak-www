/**
 * @jest-environment node
 */
import type { NextResponse } from 'next/server';

const mockGet = jest.fn();

jest.mock('next/headers', () => ({
  cookies: async () => ({ get: mockGet }),
}));

const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';

function buildRequest(params: Record<string, string>): Request {
  const url = new URL('http://127.0.0.1:3000/api/spotify/callback');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Request(url, { headers: { host: '127.0.0.1:3000' } });
}

function stateCookieCleared(response: NextResponse): boolean {
  // finalizeAfterStateCheck가 spotify_auth_state를 삭제(만료)했는지 — 삭제 시 값이 ''로 남는다.
  return response.cookies.get('spotify_auth_state')?.value === '';
}

const STORED_STATE = 'stored-state-token';

describe('GET /api/spotify/callback', () => {
  const originalEnv = process.env;
  let fetchSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    mockGet.mockReset();
    process.env = { ...originalEnv };
    fetchSpy = jest.spyOn(global, 'fetch');
    // 토큰 실패/예외 경로는 의도적으로 console.error를 호출한다 — 테스트 로그를 더럽히지 않도록 stub하고 호출만 검증한다.
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    errorSpy.mockRestore();
    process.env = originalEnv;
  });

  it('does not call the token endpoint and does not consume state when state mismatches', async () => {
    mockGet.mockReturnValue({ value: STORED_STATE });
    const { GET } = await import('../route');

    const response = await GET(buildRequest({ code: 'auth-code', state: 'different-state' }));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    expect(response.cookies.get('spotify_auth_state')?.value).toBeUndefined();
  });

  it('consumes the state cookie even when client credentials are missing (post-validation 500)', async () => {
    mockGet.mockReturnValue({ value: STORED_STATE });
    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;
    const { GET } = await import('../route');

    const response = await GET(buildRequest({ code: 'auth-code', state: STORED_STATE }));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(response.status).toBe(500);
    expect(stateCookieCleared(response)).toBe(true);
    expect(response.headers.get('Cache-Control')).toBe('no-store, private');
  });

  it('consumes the state cookie and hardens headers when the token exchange fails', async () => {
    mockGet.mockReturnValue({ value: STORED_STATE });
    process.env.SPOTIFY_CLIENT_ID = 'client-id';
    process.env.SPOTIFY_CLIENT_SECRET = 'client-secret';
    fetchSpy.mockResolvedValue(new Response('invalid_grant', { status: 400 }));
    const { GET } = await import('../route');

    const response = await GET(buildRequest({ code: 'auth-code', state: STORED_STATE }));

    expect(fetchSpy).toHaveBeenCalledWith(
      TOKEN_ENDPOINT,
      expect.objectContaining({ method: 'POST', cache: 'no-store' })
    );
    expect(response.status).toBe(400);
    expect(stateCookieCleared(response)).toBe(true);
    expect(response.headers.get('Cache-Control')).toBe('no-store, private');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(errorSpy).toHaveBeenCalledWith('[Spotify] 토큰 발급 실패:', 400, 'invalid_grant');
  });

  it('returns the refresh token HTML with no-store/no-referrer/noindex headers and consumes state on success', async () => {
    mockGet.mockReturnValue({ value: STORED_STATE });
    process.env.SPOTIFY_CLIENT_ID = 'client-id';
    process.env.SPOTIFY_CLIENT_SECRET = 'client-secret';
    fetchSpy.mockResolvedValue(
      Response.json({
        access_token: 'access',
        token_type: 'Bearer',
        scope: 'user-read-currently-playing',
        expires_in: 3600,
        refresh_token: 'super-secret-refresh-token',
      })
    );
    const { GET } = await import('../route');

    const response = await GET(buildRequest({ code: 'auth-code', state: STORED_STATE }));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('super-secret-refresh-token');
    expect(response.headers.get('Cache-Control')).toBe('no-store, private');
    expect(response.headers.get('Pragma')).toBe('no-cache');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
    expect(stateCookieCleared(response)).toBe(true);
  });
});
