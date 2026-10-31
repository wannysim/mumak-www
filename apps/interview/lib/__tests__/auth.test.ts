import { createHash } from 'node:crypto';

import { createSession, readAuthConfig, SESSION_SECONDS, sessionCookie, validSession, validToken } from '../auth';

const token = 'unit-test-only-not-a-real-key-123456789';
const env = {
  INTERVIEW_ORIGIN: 'https://practice.example.com',
  INTERVIEW_TOKEN_SHA256: createHash('sha256').update(token).digest('hex'),
  INTERVIEW_SESSION_SECRET: 'ab'.repeat(32),
};
const config = readAuthConfig(env)!;
describe('private access boundary', () => {
  it('fails closed for missing or unsafe configuration', () => {
    expect(readAuthConfig({})).toBeNull();
    for (const origin of [
      'http://example.com',
      'https://practice.example.com/',
      'not-url',
      'https://practice.example.com/path',
    ])
      expect(readAuthConfig({ ...env, INTERVIEW_ORIGIN: origin })).toBeNull();
    expect(readAuthConfig({ ...env, INTERVIEW_SESSION_SECRET: 'short' })).toBeNull();
    expect(readAuthConfig({ ...env, INTERVIEW_ORIGIN: 'http://interview.mumak.localhost:1355' })?.secure).toBe(false);
    expect(readAuthConfig({ ...env, INTERVIEW_ORIGIN: 'http://localhost:3008' })?.cookieName).toBe('interview');
  });
  it('accepts only the configured key', () => {
    expect(validToken(token, config)).toBe(true);
    expect(validToken(`${token}x`, config)).toBe(false);
    expect(validToken('short', config)).toBe(false);
    expect(validToken('a'.repeat(257), config)).toBe(false);
    expect(validToken(token, { ...config, tokenHash: 'zz'.repeat(32) })).toBe(false);
  });
  it('rejects tampering, expiry, future timestamps and rotated keys', () => {
    const now = 1793500000000;
    const session = createSession(config, now);
    expect(validSession(session, config, now)).toBe(true);
    expect(validSession(session, config, now + SESSION_SECONDS * 1000)).toBe(false);
    expect(validSession(session, config, now - 1000)).toBe(false);
    expect(validSession(session.slice(0, -1) + (session.endsWith('0') ? '1' : '0'), config, now)).toBe(false);
    expect(validSession(session, { ...config, tokenHash: 'cd'.repeat(32) }, now)).toBe(false);
    expect(validSession(session, { ...config, secret: 'ef'.repeat(32) }, now)).toBe(false);
    expect(validSession(session, { ...config, origin: 'https://other.example.com' }, now)).toBe(false);
    expect(validSession(undefined, config)).toBe(false);
    expect(validSession('bad', config)).toBe(false);
  });
  it('uses host-only HttpOnly cookies and can expire them', () => {
    expect(sessionCookie(config, 'session')).toContain('__Host-interview=session; Path=/; HttpOnly; SameSite=Strict;');
    expect(sessionCookie(config, 'session')).toContain('; Secure');
    expect(sessionCookie({ ...config, secure: false }, '', 0)).not.toContain('; Secure');
    expect(sessionCookie(config, '', 0)).toContain('Max-Age=0');
  });
});
