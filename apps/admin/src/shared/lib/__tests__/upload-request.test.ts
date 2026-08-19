/** @jest-environment node */

import { createHash } from 'node:crypto';

import { authorizeUploadRequest, readUploadRuntimeConfig } from '../upload-request';

const token = 'correct-token';
const validEnv = {
  MEDIA_ADMIN_ORIGIN: 'https://media-admin.example.com',
  MEDIA_ADMIN_TOKEN_SHA256: createHash('sha256').update(token).digest('hex'),
  MEDIA_ROOT: '/data/images',
  MEDIA_MIN_FREE_BYTES: '1024',
  MEDIA_UPLOAD_TIMEOUT_MS: '120000',
};

describe('readUploadRuntimeConfig', () => {
  it('accepts an HTTPS origin, hashed token, safe absolute root, and positive limits', () => {
    expect(readUploadRuntimeConfig(validEnv)).toMatchObject({
      expectedOrigin: validEnv.MEDIA_ADMIN_ORIGIN,
      storageRoot: '/data/images',
      minFreeBytes: 1024,
      timeoutMs: 120000,
    });
  });

  it('allows HTTP only for local development hostnames', () => {
    expect(
      readUploadRuntimeConfig({
        ...validEnv,
        MEDIA_ADMIN_ORIGIN: 'http://admin.mumak.localhost:1355',
      }).expectedOrigin
    ).toBe('http://admin.mumak.localhost:1355');
  });

  it.each([
    ['MEDIA_ADMIN_ORIGIN', 'http://media-admin.example.com'],
    ['MEDIA_ADMIN_ORIGIN', 'https://media-admin.example.com/path'],
    ['MEDIA_ADMIN_TOKEN_SHA256', token],
    ['MEDIA_ROOT', '/'],
    ['MEDIA_ROOT', 'relative/path'],
    ['MEDIA_MIN_FREE_BYTES', '0'],
    ['MEDIA_UPLOAD_TIMEOUT_MS', '1.5'],
  ])('rejects an unsafe %s value', (key, value) => {
    expect(() => readUploadRuntimeConfig({ ...validEnv, [key]: value })).toThrow(`Invalid ${key}`);
  });
});

describe('authorizeUploadRequest', () => {
  const config = readUploadRuntimeConfig(validEnv);

  function request(origin: string | null, authorization: string | null) {
    const headers = new Headers();
    if (origin) headers.set('origin', origin);
    if (authorization) headers.set('authorization', authorization);
    return { headers };
  }

  it('requires the exact configured Origin and valid bearer token hash', () => {
    expect(authorizeUploadRequest(request(validEnv.MEDIA_ADMIN_ORIGIN, `Bearer ${token}`), config)).toEqual({
      authorized: true,
    });
  });

  it('rejects an absent or different Origin before authentication', () => {
    expect(authorizeUploadRequest(request(null, `Bearer ${token}`), config)).toMatchObject({
      authorized: false,
      status: 403,
    });
    expect(authorizeUploadRequest(request('https://attacker.example', `Bearer ${token}`), config)).toMatchObject({
      authorized: false,
      status: 403,
    });
  });

  it.each([null, 'Basic abc', 'Bearer wrong', 'Bearer token with spaces', `Bearer ${'x'.repeat(513)}`])(
    'rejects malformed or invalid authorization %s',
    authorization => {
      expect(authorizeUploadRequest(request(validEnv.MEDIA_ADMIN_ORIGIN, authorization), config)).toEqual({
        authorized: false,
        status: 401,
        code: 'unauthorized',
      });
    }
  );
});
