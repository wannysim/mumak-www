import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export type AuthConfig = { origin: string; tokenHash: string; secret: string; cookieName: string; secure: boolean };

export function readAuthConfig(env: Record<string, string | undefined> = process.env): AuthConfig | null {
  const { INTERVIEW_ORIGIN: origin, INTERVIEW_TOKEN_SHA256: tokenHash, INTERVIEW_SESSION_SECRET: secret } = env;
  if (!origin || !/^[a-f0-9]{64}$/.test(tokenHash ?? '') || !/^[a-f0-9]{64}$/.test(secret ?? '')) return null;
  try {
    const url = new URL(origin);
    const secure = url.protocol === 'https:';
    const local = url.hostname === 'localhost' || url.hostname.endsWith('.localhost');
    if (url.origin !== origin || (!secure && !(local && url.protocol === 'http:'))) return null;
    return {
      origin,
      tokenHash: tokenHash!,
      secret: secret!,
      secure,
      cookieName: secure ? '__Host-interview' : 'interview',
    };
  } catch {
    return null;
  }
}

function equalHex(left: string, right: string) {
  return (
    /^[a-f0-9]{64}$/.test(left) &&
    /^[a-f0-9]{64}$/.test(right) &&
    timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'))
  );
}

export function validToken(token: string, config: AuthConfig) {
  return (
    token.length >= 32 &&
    token.length <= 256 &&
    equalHex(createHash('sha256').update(token).digest('hex'), config.tokenHash)
  );
}

function sign(payload: string, config: AuthConfig) {
  return createHmac('sha256', Buffer.from(config.secret, 'hex'))
    .update(`${config.origin}\n${config.tokenHash}\n${payload}`)
    .digest('hex');
}

export function createSession(config: AuthConfig, now = Date.now()) {
  const payload = `v1.${Math.floor(now / 1000)}.${randomBytes(16).toString('hex')}`;
  return `${payload}.${sign(payload, config)}`;
}

export function validSession(session: string | undefined, config: AuthConfig, now = Date.now()) {
  const match = session?.match(/^(v1\.(\d{10})\.[a-f0-9]{32})\.([a-f0-9]{64})$/);
  if (!match) return false;
  const age = Math.floor(now / 1000) - Number(match[2]);
  return age >= 0 && age < SESSION_SECONDS && equalHex(match[3]!, sign(match[1]!, config));
}

export function sessionCookie(config: AuthConfig, value: string, maxAge = SESSION_SECONDS) {
  return `${config.cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${config.secure ? '; Secure' : ''}`;
}
