import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type StoredObject = { body: Buffer; etag: string };
export type ObjectStore = {
  get(bucket: 'private' | 'public', key: string, maxBytes: number): Promise<StoredObject | undefined>;
  put(
    bucket: 'private' | 'public',
    key: string,
    body: Buffer,
    options: {
      contentType: string;
      match: string;
    }
  ): Promise<boolean>;
  presign(key: string, bytes: number): Promise<string>;
};

export type ImageLibraryStore = {
  listImages(cursor?: string): Promise<{
    objects: { key: string; bytes: number; modifiedAt: string | null }[];
    cursor: string | null;
  }>;
};

export function createR2Store(env: NodeJS.ProcessEnv = process.env): ObjectStore & ImageLibraryStore {
  const required = (name: string) => {
    const value = env[name];
    if (!value) throw new Error(`Missing ${name}`);
    return value;
  };
  const accountId = required('R2_ACCOUNT_ID');
  if (!/^[0-9a-f]{32}$/.test(accountId)) throw new Error('Invalid R2_ACCOUNT_ID');
  const buckets = { private: required('R2_PRIVATE_BUCKET'), public: required('R2_PUBLIC_BUCKET') };
  if (buckets.private === buckets.public) throw new Error('R2 buckets must differ');
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: required('R2_ACCESS_KEY_ID'), secretAccessKey: required('R2_SECRET_ACCESS_KEY') },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    maxAttempts: 2,
  });
  return {
    async listImages(cursor) {
      const response = await client.send(
        new ListObjectsV2Command({
          Bucket: buckets.public,
          Prefix: 'blog/',
          MaxKeys: 200,
          ContinuationToken: cursor,
        }),
        { abortSignal: AbortSignal.timeout(30_000) }
      );
      if (response.IsTruncated && !response.NextContinuationToken) throw new Error('Missing R2 cursor');
      return {
        objects: (response.Contents ?? []).flatMap(object =>
          object.Key && typeof object.Size === 'number'
            ? [{ key: object.Key, bytes: object.Size, modifiedAt: object.LastModified?.toISOString() ?? null }]
            : []
        ),
        cursor: response.IsTruncated ? response.NextContinuationToken! : null,
      };
    },
    async get(bucket, key, maxBytes) {
      try {
        const response = await client.send(new GetObjectCommand({ Bucket: buckets[bucket], Key: key }), {
          abortSignal: AbortSignal.timeout(30_000),
        });
        if (!response.Body || !response.ETag || (response.ContentLength ?? Infinity) > maxBytes) {
          if (response.Body) await response.Body.transformToWebStream().cancel();
          throw new Error('Invalid R2 object');
        }
        const reader = response.Body.transformToWebStream().getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > maxBytes) throw new Error('R2 object exceeds limit');
            chunks.push(chunk.value);
          }
        } finally {
          await reader.cancel();
        }
        return { body: Buffer.concat(chunks), etag: response.ETag };
      } catch (error) {
        if (status(error) === 404) return undefined;
        throw error;
      }
    },
    async put(bucket, key, body, { contentType, match }) {
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: buckets[bucket],
            Key: key,
            Body: body,
            ContentLength: body.length,
            ContentType: contentType,
            CacheControl: bucket === 'public' ? 'public, max-age=31536000, immutable' : 'no-store',
            ...(match === '*' ? { IfNoneMatch: '*' } : { IfMatch: match }),
          }),
          { abortSignal: AbortSignal.timeout(30_000) }
        );
        return true;
      } catch (error) {
        if (status(error) === 412 || status(error) === 409) return false;
        throw error;
      }
    },
    async presign(key, bytes) {
      return getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: buckets.private,
          Key: key,
          ContentLength: bytes,
          ContentType: 'application/octet-stream',
          IfNoneMatch: '*',
        }),
        { expiresIn: 300, signableHeaders: new Set(['content-length', 'content-type', 'if-none-match']) }
      );
    },
  };
}

function status(error: unknown) {
  if (typeof error !== 'object' || error === null || !('$metadata' in error)) return undefined;
  const metadata = error.$metadata;
  return typeof metadata === 'object' && metadata !== null && 'httpStatusCode' in metadata
    ? metadata.httpStatusCode
    : undefined;
}
