/** @jest-environment node */

import { createHash } from 'node:crypto';

import { ImageUploadError, processImageUpload } from '@/src/entities/image/image-upload';

import { OPTIONS, POST } from '../route';

jest.mock('@/src/entities/image/image-upload', () => {
  const actual = jest.requireActual('@/src/entities/image/image-upload');
  return { ...actual, processImageUpload: jest.fn() };
});

const mockedProcessImageUpload = jest.mocked(processImageUpload);
const token = 'operator-secret';
const origin = 'https://media-admin.example.com';
const result = {
  assetId: 'a'.repeat(64),
  duplicate: false,
  width: 1600,
  height: 1067,
  urls: {
    jpeg: `https://img.wannysim.com/blog/${'a'.repeat(64)}/content-v1/image.jpg`,
    webp: `https://img.wannysim.com/blog/${'a'.repeat(64)}/content-v1/image.webp`,
  },
  checksums: { source: 'a'.repeat(64), jpeg: 'b'.repeat(64), webp: 'c'.repeat(64) },
  bytes: { source: 10, jpeg: 8, webp: 6 },
};

describe('POST /api/images', () => {
  beforeEach(() => {
    mockedProcessImageUpload.mockReset();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    process.env.MEDIA_ADMIN_ORIGIN = origin;
    process.env.MEDIA_ADMIN_TOKEN_SHA256 = createHash('sha256').update(token).digest('hex');
    process.env.MEDIA_ROOT = '/data/images';
    process.env.MEDIA_MIN_FREE_BYTES = '1024';
    process.env.MEDIA_UPLOAD_TIMEOUT_MS = '120000';
    mockedProcessImageUpload.mockResolvedValue(result);
  });

  afterEach(() => jest.restoreAllMocks());

  function request({
    requestOrigin = origin,
    authorization = `Bearer ${token}`,
    contentType = 'application/octet-stream',
  }: {
    requestOrigin?: string;
    authorization?: string;
    contentType?: string;
  } = {}) {
    return new Request('https://media-admin.example.com/api/images', {
      method: 'POST',
      headers: {
        Origin: requestOrigin,
        Authorization: authorization,
        'Content-Type': contentType,
      },
      body: Uint8Array.from([0xff, 0xd8, 0xff]),
      duplex: 'half',
    } as RequestInit);
  }

  it('authenticates, streams the raw body, and returns a new immutable asset', async () => {
    const uploadRequest = request();
    const response = await POST(uploadRequest);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(result);
    expect(mockedProcessImageUpload).toHaveBeenCalledWith({
      body: uploadRequest.body,
      signal: uploadRequest.signal,
      storageRoot: '/data/images',
      minFreeBytes: 1024,
      limits: { timeoutMs: 120000 },
    });
  });

  it.each([
    [{ requestOrigin: 'https://attacker.example' }, 403, 'invalid-origin'],
    [{ authorization: 'Bearer wrong' }, 401, 'unauthorized'],
    [{ contentType: 'image/jpeg' }, 415, 'unsupported_media_type'],
  ] as const)('rejects an invalid trust-boundary request', async (options, status, code) => {
    const response = await POST(request(options));
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ code });
    expect(mockedProcessImageUpload).not.toHaveBeenCalled();
  });

  it('maps busy uploads to Retry-After without exposing internal details', async () => {
    mockedProcessImageUpload.mockRejectedValueOnce(new ImageUploadError('upload_busy'));
    const response = await POST(request());

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('5');
    await expect(response.json()).resolves.toEqual({
      error: '다른 이미지를 처리 중입니다. 잠시 후 다시 시도하세요.',
      code: 'upload_busy',
    });
  });

  it.each([
    ['payload_too_large', 413],
    ['pixel_limit_exceeded', 413],
    ['unsupported_media_type', 415],
    ['invalid_image', 422],
    ['insufficient_storage', 507],
    ['public_verification_failed', 503],
    ['corruption', 500],
  ] as const)('maps %s to %i', async (code, status) => {
    mockedProcessImageUpload.mockRejectedValueOnce(new ImageUploadError(code));
    expect((await POST(request())).status).toBe(status);
  });

  it('fails closed when runtime configuration is missing', async () => {
    delete process.env.MEDIA_ADMIN_TOKEN_SHA256;
    const response = await POST(request());
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ code: 'invalid_configuration' });
  });
});

it('denies CORS preflight', () => {
  const response = OPTIONS();
  expect(response.status).toBe(405);
  expect(response.headers.get('access-control-allow-origin')).toBeNull();
});
