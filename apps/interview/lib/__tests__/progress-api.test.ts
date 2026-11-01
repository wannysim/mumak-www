import { randomUUID } from 'node:crypto';

import { GET, PUT } from '../../app/api/progress/route';
import { createSession, readAuthConfig } from '../auth';
import { emptyProgress } from '../progress';
import { readCloudProgress, writeCloudProgress } from '../progress-repository';

let mockCookies: { value: string }[] = [];
jest.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => mockCookies }) }));
jest.mock('../progress-repository', () => ({ readCloudProgress: jest.fn(), writeCloudProgress: jest.fn() }));
const origin = 'https://interview.example.com';
beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(process.env, {
    INTERVIEW_ORIGIN: origin,
    INTERVIEW_TOKEN_SHA256: 'a'.repeat(64),
    INTERVIEW_SESSION_SECRET: 'b'.repeat(64),
  });
  mockCookies = [{ value: createSession(readAuthConfig()!) }];
});
it('protects private records from anonymous and ambiguous sessions', async () => {
  mockCookies = [];
  expect((await GET(new Request(origin + '/api/progress'))).status).toBe(401);
  mockCookies = [{ value: 'bad' }, { value: 'other' }];
  expect((await GET(new Request(origin + '/api/progress'))).status).toBe(401);
  expect(readCloudProgress).not.toHaveBeenCalled();
});
it('rejects cross-origin and malformed writes before storage access', async () => {
  const request = (body: string, source = origin) =>
    new Request(origin + '/api/progress', {
      method: 'PUT',
      headers: { origin: source, 'content-type': 'application/json' },
      body,
    });
  expect((await PUT(request('{}', 'https://other.example.com'))).status).toBe(403);
  expect((await PUT(request('{}'))).status).toBe(400);
  expect((await PUT(request('x'.repeat(2_000_600)))).status).toBe(413);
  expect(writeCloudProgress).not.toHaveBeenCalled();
});
it('returns the newer server record on a stale write, without caching it', async () => {
  const document = { revision: randomUUID(), progress: emptyProgress() };
  jest.mocked(writeCloudProgress).mockResolvedValue({ accepted: false, document });
  const response = await PUT(
    new Request(origin + '/api/progress', {
      method: 'PUT',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ baseRevision: null, revision: randomUUID(), progress: emptyProgress() }),
    })
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual(document);
  expect(response.headers.get('cache-control')).toContain('no-store');
});
it('a database outage is an error, never an empty replacement record', async () => {
  jest.mocked(readCloudProgress).mockRejectedValue(new Error('unavailable'));
  const response = await GET(new Request(origin + '/api/progress'));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: 'storage_unavailable' });
});
