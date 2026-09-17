/** @jest-environment node */
import { createHash } from 'node:crypto';

import { readAdminAuthConfig } from '@/src/shared/lib/admin-auth-config';
import { createSession, sessionCookieName } from '@/src/shared/lib/admin-session';
import { createR2Store } from '@/src/shared/lib/r2-store';

import { GET } from '../route';

jest.mock('@/src/shared/lib/r2-store', () => ({ createR2Store: jest.fn() }));
const env = { ...process.env };
const listImages = jest.fn();
const origin = 'https://admin.example.com';
beforeEach(() => {
  jest.clearAllMocks();
  process.env.MEDIA_ADMIN_ORIGIN = origin;
  process.env.MEDIA_ADMIN_SESSION_SECRET = 'a'.repeat(64);
  process.env.MEDIA_ADMIN_TOKEN_SHA256 = createHash('sha256').update('secret').digest('hex');
  jest.mocked(createR2Store).mockReturnValue({ listImages, get: jest.fn(), put: jest.fn(), presign: jest.fn() });
  listImages.mockResolvedValue({ objects: [], cursor: null });
});
afterEach(() => {
  process.env = { ...env };
});
function request(query = '', headers: Record<string, string> = {}) {
  const config = readAdminAuthConfig();
  return new Request(`${origin}/api/images/library${query}`, {
    headers: { Cookie: `${sessionCookieName(config)}=${createSession(config)}`, ...headers },
  });
}
it.each([
  [{ Cookie: '' }, 401],
  [{ Cookie: 'mumak-admin-session=invalid', Authorization: 'Bearer secret' }, 401],
  [{ Origin: 'https://evil.example' }, 403],
  [{ 'Sec-Fetch-Site': 'cross-site' }, 403],
] as const)('rejects unauthorized or cross-site listing before R2 access', async (headers, status) => {
  expect((await GET(request('', headers))).status).toBe(status);
  expect(createR2Store).not.toHaveBeenCalled();
});
it('lists only fixed public renditions, preserves cursor, and disables caching', async () => {
  const key = `blog/${'a'.repeat(64)}/content-v1/image.jpg`;
  listImages.mockResolvedValue({
    objects: [
      key,
      'blog/control/upload-budget.json',
      'blog/staging/id',
      `blog/${'a'.repeat(64)}/source.jpg`,
      'other/image.jpg',
    ].map(key => ({ key, bytes: 123, modifiedAt: null })),
    cursor: 'next',
  });
  const result = await GET(request('?cursor=previous%2B%2F%3D'));
  expect(result.status).toBe(200);
  expect(result.headers.get('Cache-Control')).toBe('no-store');
  expect(listImages).toHaveBeenCalledWith('previous+/=');
  await expect(result.json()).resolves.toEqual({
    files: [{ key, bytes: 123, modifiedAt: null, url: `https://img.wannysim.com/${key}` }],
    cursor: 'next',
  });
});
it.each(['?prefix=blog/control/', '?bucket=private', '?cursor=', `?cursor=${'a'.repeat(4097)}`])(
  'rejects unsupported listing parameters %s',
  async query => {
    expect((await GET(request(query))).status).toBe(400);
    expect(createR2Store).not.toHaveBeenCalled();
  }
);
it('hides storage error details', async () => {
  listImages.mockRejectedValueOnce(new Error('secret endpoint'));
  const result = await GET(request());
  expect(result.status).toBe(503);
  expect(await result.text()).not.toContain('secret');
});
it('fails closed when auth configuration is missing', async () => {
  const req = request();
  delete process.env.MEDIA_ADMIN_SESSION_SECRET;
  expect((await GET(req)).status).toBe(503);
  expect(createR2Store).not.toHaveBeenCalled();
});
