/** @jest-environment node */
import { createHash } from 'node:crypto';

import { ImageUploadError } from '@/src/entities/image/image-upload';
import { createR2Uploader, R2UploadError } from '@/src/entities/image/r2-upload';
import { readAdminAuthConfig } from '@/src/shared/lib/admin-auth-config';
import { createSession, sessionCookieName } from '@/src/shared/lib/admin-session';
import { createR2Store } from '@/src/shared/lib/r2-store';

import { handleR2Upload } from '../handle-upload-request';

jest.mock('@/src/entities/image/r2-upload', () => ({
  ...jest.requireActual('@/src/entities/image/r2-upload'),
  createR2Uploader: jest.fn(),
}));
jest.mock('@/src/shared/lib/r2-store', () => ({ createR2Store: jest.fn() }));
function testCookie() {
  const config = readAdminAuthConfig();
  return `${sessionCookieName(config)}=${createSession(config)}`;
}
const origin = 'https://admin.example.com';
const issue = jest.fn();
const publish = jest.fn();

describe('R2 upload request trust boundaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MEDIA_ADMIN_ORIGIN = origin;
    process.env.MEDIA_ADMIN_SESSION_SECRET = 'a'.repeat(64);
    process.env.MEDIA_ADMIN_TOKEN_SHA256 = createHash('sha256').update('secret').digest('hex');
    jest.mocked(createR2Uploader).mockReturnValue({ issue, publish });
    issue.mockResolvedValue({ ticketId: 'ticket' });
    publish.mockResolvedValue({ duplicate: false });
  });

  function request(body = JSON.stringify({ bytes: 12 }), headers: Record<string, string> = {}) {
    return new Request(origin, {
      method: 'POST',
      headers: { Origin: origin, Cookie: testCookie(), 'Content-Type': 'application/json', ...headers },
      body,
    });
  }

  it.each<Record<string, string>>([{ Cookie: '', Authorization: 'Bearer secret' }, { Origin: 'https://evil.example' }])(
    'rejects unauthorized requests before accessing R2: %j',
    async headers => {
      const response = await handleR2Upload(request('{}', headers), 'issue');
      expect([401, 403]).toContain(response.status);
      expect(createR2Store).not.toHaveBeenCalled();
    }
  );
  it('admits a size and publishes only a server-issued ticket', async () => {
    expect((await handleR2Upload(request(), 'issue')).status).toBe(201);
    expect(issue).toHaveBeenCalledWith(12);
    expect((await handleR2Upload(request(JSON.stringify({ ticketId: 'ticket' })), 'publish')).status).toBe(201);
    expect(publish).toHaveBeenCalledWith('ticket');
  });
  it.each(['null', '{}', '{', '"arbitrary-key"', 'x'.repeat(1025)])('rejects malformed bounded JSON', async body => {
    expect((await handleR2Upload(request(body), 'issue')).status).toBe(400);
    expect(issue).not.toHaveBeenCalled();
  });
  it('does not accept a user-supplied storage key as a publication ticket', async () => {
    expect((await handleR2Upload(request('{"key":"other-app/source.jpg"}'), 'publish')).status).toBe(400);
    expect(publish).not.toHaveBeenCalled();
  });
  it('rejects raw binary requests', async () => {
    expect((await handleR2Upload(request('raw', { 'Content-Type': 'application/octet-stream' }), 'issue')).status).toBe(
      415
    );
  });
  it.each([
    ['collision', 500, '다시 시도하지 말고'],
    ['corruption', 500, '다시 시도하지 말고'],
    ['public_verification_failed', 503, '잠시 후'],
    ['payload_too_large', 422, '32 MiB'],
  ] as const)('reports %s as %s with operator guidance', async (code, status, guidance) => {
    publish.mockRejectedValueOnce(new ImageUploadError(code));
    const response = await handleR2Upload(request(JSON.stringify({ ticketId: 'ticket' })), 'publish');
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ code, error: expect.stringContaining(guidance) });
  });
  it.each([
    ['daily_limit', 429],
    ['storage_limit', 507],
    ['upload_busy', 429],
    ['invalid_ticket', 400],
  ] as const)('maps %s to %s without leaking storage errors', async (code, status) => {
    issue.mockRejectedValueOnce(new R2UploadError(code));
    const response = await handleR2Upload(request(), 'issue');
    expect(response.status).toBe(status);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
