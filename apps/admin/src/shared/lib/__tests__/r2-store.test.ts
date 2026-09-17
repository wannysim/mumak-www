/** @jest-environment node */
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

import { createR2Store } from '../r2-store';

it('lists only the public blog prefix with bounded pages and passes continuation tokens unchanged', async () => {
  const send = jest.spyOn(S3Client.prototype, 'send').mockResolvedValueOnce({
    Contents: [{ Key: 'blog/image', Size: 123, LastModified: new Date('2026-09-18T00:00:00Z') }],
    IsTruncated: true,
    NextContinuationToken: 'next',
  } as never);
  const store = createR2Store({
    NODE_ENV: 'test',
    R2_ACCOUNT_ID: 'a'.repeat(32),
    R2_PRIVATE_BUCKET: 'private',
    R2_PUBLIC_BUCKET: 'public',
    R2_ACCESS_KEY_ID: 'test-only',
    R2_SECRET_ACCESS_KEY: 'test-only',
  });
  await expect(store.listImages('previous')).resolves.toEqual({
    objects: [{ key: 'blog/image', bytes: 123, modifiedAt: '2026-09-18T00:00:00.000Z' }],
    cursor: 'next',
  });
  expect(send.mock.calls[0]?.[0]).toBeInstanceOf(ListObjectsV2Command);
  expect(send.mock.calls[0]?.[0].input).toEqual({
    Bucket: 'public',
    Prefix: 'blog/',
    MaxKeys: 200,
    ContinuationToken: 'previous',
  });
  send.mockResolvedValueOnce({} as never);
  await expect(store.listImages()).resolves.toEqual({ objects: [], cursor: null });
  send.mockResolvedValueOnce({ IsTruncated: true } as never);
  await expect(store.listImages()).rejects.toThrow('Missing R2 cursor');
  send.mockRestore();
});
