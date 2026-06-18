/**
 * PKCE(Proof Key for Code Exchange) 헬퍼.
 * 공개 클라이언트(SPA)에서 client_secret 없이 Authorization Code 플로우를 쓰기 위한 값들을 생성한다.
 * https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
 */

function base64UrlEncode(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** code_verifier: 43~128자의 URL-safe 랜덤 문자열. */
export function generateCodeVerifier(length = 64): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, value => charset[value % charset.length]).join('');
}

/** code_verifier 를 SHA-256 → base64url 로 변환한 code_challenge. */
export async function deriveCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64UrlEncode(digest);
}

/** CSRF 방지용 state 값. */
export function generateState(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)).buffer);
}
