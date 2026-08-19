/** @jest-environment node */

import { createHash } from 'node:crypto';
import {
  lutimes,
  mkdtemp,
  mkdir,
  open,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  utimes,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

import { ImageUploadError, type ImageUploadResult, processImageUpload } from '../image-upload';

const SHA_PATTERN = /^[0-9a-f]{64}$/;
const FIXED_INPUT_PATH = path.join(__dirname, 'fixtures', 'landscape-orientation-6.jpg');
const FIXED_INPUT_SHA256 = 'a05082c57819232106a0612f57268efab011f7a2a477483b878a2b4509cd8e59';
const SOURCE_V1_SHA256 = 'e4c54beb780223fa8bf1ced9d83712225ef07108efdf884fddca38c58975e287';

describe('processImageUpload', () => {
  let storageRoot: string;
  let jpeg: Buffer;

  beforeAll(async () => {
    jpeg = await sharp({
      create: { width: 20, height: 10, channels: 3, background: '#123456' },
    })
      .withExif({ IFD0: { Copyright: 'must-not-survive' }, IFD3: { GPSLatitude: '37/1' } })
      .jpeg()
      .toBuffer();
  });

  it('pins source-v1 bytes for the fixed upstream JPEG fixture', async () => {
    const fixedInput = await readFile(FIXED_INPUT_PATH);

    expect(await sha256(FIXED_INPUT_PATH)).toBe(FIXED_INPUT_SHA256);
    const result = await upload(fixedInput);

    expect(result).toMatchObject({
      assetId: SOURCE_V1_SHA256,
      width: 600,
      height: 450,
      checksums: { source: SOURCE_V1_SHA256 },
      bytes: { source: 176_242 },
    });
    expect(await sha256(paths(result.assetId).source)).toBe(SOURCE_V1_SHA256);
  });

  beforeEach(async () => {
    storageRoot = await mkdtemp(path.join(os.tmpdir(), 'mumak-image-upload-'));
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await rm(storageRoot, { recursive: true, force: true });
  });

  it('publishes stripped canonical and complete immutable renditions', async () => {
    const verifyPublic = jest.fn(async () => undefined);

    const result = await upload(jpeg, { verifyPublic });

    expect(result.assetId).toMatch(SHA_PATTERN);
    expect(result).toMatchObject({ duplicate: false, width: 20, height: 10 });
    expect(result.urls.jpeg).toBe(`https://img.wannysim.com/blog/${result.assetId}/content-v1/image.jpg`);
    expect(result.urls.webp).toBe(`https://img.wannysim.com/blog/${result.assetId}/content-v1/image.webp`);
    expect(verifyPublic).toHaveBeenCalledWith(result);

    const locations = paths(result.assetId);
    const [canonicalMetadata, jpegMetadata, webpMetadata, manifest] = await Promise.all([
      sharp(locations.source).metadata(),
      sharp(locations.jpeg).metadata(),
      sharp(locations.webp).metadata(),
      readManifest(locations.manifest),
    ]);

    expect(canonicalMetadata).toMatchObject({ format: 'jpeg', width: 20, height: 10, space: 'srgb' });
    expect(jpegMetadata).toMatchObject({ format: 'jpeg', width: 20, height: 10, space: 'srgb' });
    expect(webpMetadata).toMatchObject({ format: 'webp', width: 20, height: 10, space: 'srgb' });
    for (const metadata of [canonicalMetadata, jpegMetadata, webpMetadata]) {
      expect(metadata).not.toHaveProperty('exif');
      expect(metadata).not.toHaveProperty('icc');
      expect(metadata).not.toHaveProperty('xmp');
      expect(metadata).not.toHaveProperty('orientation');
    }
    expect(manifest).toMatchObject({
      schemaVersion: 1,
      assetId: result.assetId,
      canonicalPolicy: 'source-v1',
      source: { sha256: result.checksums.source },
      processor: { sharp: sharp.versions.sharp, libvips: sharp.versions.vips },
      variants: {
        'content-v1': {
          jpeg: { sha256: result.checksums.jpeg },
          webp: { sha256: result.checksums.webp },
        },
      },
    });
    expect(await sha256(locations.source)).toBe(result.assetId);
    await expectWorldReadable(locations.jpeg);
    await expectWorldReadable(locations.webp);
    expect(await readdir(path.join(storageRoot, '.staging'))).toEqual([]);
  });

  it('returns the existing immutable asset for a duplicate without rewriting it', async () => {
    const first = await upload(jpeg);
    const locations = paths(first.assetId);
    const firstModifiedAt = (await stat(locations.jpeg)).mtimeMs;

    const second = await upload(jpeg);

    expect(second).toEqual({ ...first, duplicate: true });
    expect((await stat(locations.jpeg)).mtimeMs).toBe(firstModifiedAt);
  });

  it('returns existing bytes after a processor upgrade without regenerating renditions', async () => {
    const first = await upload(jpeg);
    const locations = paths(first.assetId);
    const manifest = await readManifest(locations.manifest);
    manifest.processor = { sharp: '0.0.1', libvips: '0.0.1' };
    await writeFile(locations.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
    const oldTimestamp = new Date('2001-01-01T00:00:00.000Z');
    await Promise.all([
      utimes(locations.source, oldTimestamp, oldTimestamp),
      utimes(locations.jpeg, oldTimestamp, oldTimestamp),
      utimes(locations.webp, oldTimestamp, oldTimestamp),
    ]);
    const before = await Promise.all([readFile(locations.source), readFile(locations.jpeg), readFile(locations.webp)]);

    const duplicate = await upload(jpeg);

    expect(duplicate).toEqual({ ...first, duplicate: true });
    await expect(
      Promise.all([readFile(locations.source), readFile(locations.jpeg), readFile(locations.webp)])
    ).resolves.toEqual(before);
    await expect(
      Promise.all([stat(locations.source), stat(locations.jpeg), stat(locations.webp)]).then(files =>
        files.map(file => file.mtime.toISOString())
      )
    ).resolves.toEqual(Array(3).fill(oldTimestamp.toISOString()));
  });

  it('recovers empty and incomplete claims before publishing the full set', async () => {
    const firstStorage = storageRoot;
    const reference = await upload(jpeg);
    const canonical = await readFile(paths(reference.assetId).source);
    await rm(storageRoot, { recursive: true });
    storageRoot = await mkdtemp(path.join(os.tmpdir(), 'mumak-image-upload-'));

    const privateDirectory = path.join(storageRoot, 'private', reference.assetId);
    const publishedDirectory = path.join(storageRoot, 'published', reference.assetId);
    await mkdir(privateDirectory, { recursive: true });
    await mkdir(publishedDirectory, { recursive: true });
    await writeExclusive(path.join(privateDirectory, 'source.jpg'), canonical);

    const recovered = await upload(jpeg);

    expect(recovered).toMatchObject({ assetId: reference.assetId, duplicate: false });
    await expect(stat(paths(reference.assetId).jpeg)).resolves.toBeDefined();
    await expect(stat(paths(reference.assetId).webp)).resolves.toBeDefined();
    expect(firstStorage).not.toBe(storageRoot);
  });

  it('does not expose a partial public set while verification is blocked', async () => {
    let releaseVerification: (() => void) | undefined;
    const verificationStarted = new Promise<void>(resolve => {
      releaseVerification = resolve;
    });
    const uploadPromise = upload(jpeg, {
      verifyPublic: async () => {
        await verificationStarted;
      },
    });

    await waitFor(async () => {
      const [assetId] = await readdir(path.join(storageRoot, 'published'));
      if (!assetId) return false;
      return (await readdir(path.join(storageRoot, 'published', assetId, 'content-v1'))).length === 2;
    });
    const [assetId] = await readdir(path.join(storageRoot, 'published'));
    const contentFiles = await readdir(path.join(storageRoot, 'published', assetId!, 'content-v1'));

    expect(contentFiles.toSorted()).toEqual(['image.jpg', 'image.webp']);
    releaseVerification?.();
    await uploadPromise;
  });

  it.each(['before-private-commit', 'after-private-commit', 'before-public-rename', 'after-public-rename'] as const)(
    'recovers after a simulated crash at %s without exposing partial public files',
    async checkpoint => {
      const crash = new Error(`crash:${checkpoint}`);
      await expect(
        upload(jpeg, {
          onStorageCheckpoint: current => {
            if (current === checkpoint) throw crash;
          },
        })
      ).rejects.toMatchObject({ code: 'storage_failure' });

      const publishedClaims = await readdir(path.join(storageRoot, 'published'));
      for (const assetId of publishedClaims) {
        const contentDirectory = path.join(storageRoot, 'published', assetId, 'content-v1');
        const content = await readdir(contentDirectory).catch(error => {
          if (error?.code === 'ENOENT') return [];
          throw error;
        });
        expect(content).toEqual(content.length === 0 ? [] : expect.arrayContaining(['image.jpg', 'image.webp']));
        expect(content).not.toHaveLength(1);
      }

      const recovered = await upload(jpeg);
      expect(await readdir(path.join(storageRoot, 'published', recovered.assetId, 'content-v1'))).toEqual(
        expect.arrayContaining(['image.jpg', 'image.webp'])
      );
    }
  );

  it.each([
    ['after-canonical-write', new Error('source.jpg: write error\nsystem error: No space left on device')],
    ['after-private-commit', Object.assign(new Error('disk full'), { code: 'ENOSPC' })],
    ['after-public-rename', Object.assign(new Error('quota full'), { code: 'EDQUOT' })],
  ] as const)(
    'maps storage capacity failure at %s, preserves existing assets, and remains recoverable',
    async (checkpoint, capacityError) => {
      const existing = await upload(jpeg);
      const existingLocations = paths(existing.assetId);
      const existingBytes = await Promise.all([
        readFile(existingLocations.source),
        readFile(existingLocations.jpeg),
        readFile(existingLocations.webp),
      ]);
      const otherJpeg = await sharp({
        create: { width: 21, height: 11, channels: 3, background: '#abcdef' },
      })
        .jpeg()
        .toBuffer();
      await expect(
        upload(otherJpeg, {
          onStorageCheckpoint: current => {
            if (current === checkpoint) throw capacityError;
          },
        })
      ).rejects.toMatchObject({ code: 'insufficient_storage' });

      expect(await readdir(path.join(storageRoot, '.staging'))).toEqual([]);
      await expect(
        Promise.all([
          readFile(existingLocations.source),
          readFile(existingLocations.jpeg),
          readFile(existingLocations.webp),
        ])
      ).resolves.toEqual(existingBytes);
      for (const assetId of await readdir(path.join(storageRoot, 'published'))) {
        const content = await readdir(path.join(storageRoot, 'published', assetId, 'content-v1')).catch(error => {
          if (error?.code === 'ENOENT') return [];
          throw error;
        });
        expect(content).toEqual(content.length === 0 ? [] : expect.arrayContaining(['image.jpg', 'image.webp']));
        expect(content).not.toHaveLength(1);
      }

      await expect(upload(otherJpeg)).resolves.toMatchObject({ assetId: expect.stringMatching(SHA_PATTERN) });
    }
  );

  it.each([
    ['an empty body', new Uint8Array(), 'invalid_image'],
    ['non-JPEG bytes', new TextEncoder().encode('not an image'), 'unsupported_media_type'],
    ['a corrupt JPEG stream', Uint8Array.from([0xff, 0xd8, 0xff, 0x00]), 'invalid_image'],
  ] as const)('rejects %s and cleans staging', async (_label, bytes, code) => {
    await expect(upload(bytes)).rejects.toMatchObject({ code });
    expect(await readdir(path.join(storageRoot, '.staging'))).toEqual([]);
    expect(await readdir(path.join(storageRoot, 'published'))).toEqual([]);
  });

  it.each([
    ['a zero byte limit', { limits: { maxBytes: 0 } }],
    ['a relative storage root', { storageRoot: 'relative/path' }],
    ['a negative free-space reserve', { minFreeBytes: -1 }],
  ] as const)('rejects invalid configuration: %s', async (_label, overrides) => {
    await expect(upload(jpeg, overrides)).rejects.toMatchObject({ code: 'invalid_configuration' });
  });

  it('rejects a missing body and an already-aborted request', async () => {
    await expect(upload(jpeg, { body: null })).rejects.toMatchObject({ code: 'missing_body' });

    const controller = new AbortController();
    controller.abort();
    await expect(upload(jpeg, { signal: controller.signal })).rejects.toMatchObject({ code: 'upload_aborted' });
    expect(await readdir(path.join(storageRoot, '.staging'))).toEqual([]);
  });

  it('rejects a body whose actual bytes exceed the configured limit', async () => {
    await expect(upload(jpeg, { limits: { maxBytes: jpeg.byteLength - 1 } })).rejects.toMatchObject({
      code: 'payload_too_large',
    });
    expect(await readdir(path.join(storageRoot, '.staging'))).toEqual([]);
  });

  it('accepts an image exactly at the byte and pixel limits', async () => {
    await expect(upload(jpeg, { limits: { maxBytes: jpeg.byteLength, maxPixels: 20 * 10 } })).resolves.toMatchObject({
      width: 20,
      height: 10,
    });
  });

  it('rejects a decoded image over the pixel limit', async () => {
    await expect(upload(jpeg, { limits: { maxPixels: 199 } })).rejects.toMatchObject({
      code: 'pixel_limit_exceeded',
    });
    expect(await readdir(path.join(storageRoot, 'published'))).toEqual([]);
  });

  it('rejects when the free-space reserve cannot remain', async () => {
    await expect(upload(jpeg, { minFreeBytes: Number.MAX_SAFE_INTEGER })).rejects.toMatchObject({
      code: 'insufficient_storage',
    });
    expect(await readdir(storageRoot)).toEqual(expect.arrayContaining(['.staging', 'private', 'published']));
    expect(await readdir(path.join(storageRoot, 'published'))).toEqual([]);
  });

  it('rejects a symlinked storage root before cleanup can touch its target', async () => {
    const realStorage = await mkdtemp(path.join(os.tmpdir(), 'mumak-image-target-'));
    const link = path.join(os.tmpdir(), `mumak-image-link-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await symlink(realStorage, link, 'dir');

    try {
      await expect(
        processImageUpload({
          body: bytesToStream(jpeg),
          storageRoot: link,
          minFreeBytes: 0,
          verifyPublic: async () => undefined,
        })
      ).rejects.toMatchObject({ code: 'storage_failure' });
      expect(await readdir(realStorage)).toEqual([]);
    } finally {
      await rm(link, { force: true });
      await rm(realStorage, { recursive: true, force: true });
    }
  });

  it('initializes a missing root but rejects a symlinked storage child', async () => {
    const nestedRoot = path.join(storageRoot, 'nested');
    await expect(
      processImageUpload({
        body: bytesToStream(jpeg),
        storageRoot: nestedRoot,
        minFreeBytes: 0,
        verifyPublic: async () => undefined,
      })
    ).resolves.toMatchObject({ duplicate: false });
    expect(await readdir(nestedRoot)).toEqual(expect.arrayContaining(['.staging', 'private', 'published']));

    const unsafeRoot = path.join(storageRoot, 'unsafe');
    const external = path.join(storageRoot, 'external');
    await Promise.all([mkdir(unsafeRoot), mkdir(external)]);
    await symlink(external, path.join(unsafeRoot, '.staging'), 'dir');
    await expect(
      processImageUpload({
        body: bytesToStream(jpeg),
        storageRoot: unsafeRoot,
        minFreeBytes: 0,
        verifyPublic: async () => undefined,
      })
    ).rejects.toMatchObject({ code: 'storage_failure' });
    expect(await readdir(external)).toEqual([]);
  });

  it('only cleans stale server UUID stages and never follows staging symlinks', async () => {
    const staging = path.join(storageRoot, '.staging');
    const staleStage = path.join(staging, '123e4567-e89b-42d3-a456-426614174000');
    const recentStage = path.join(staging, '123e4567-e89b-42d3-a456-426614174001');
    const external = await mkdtemp(path.join(os.tmpdir(), 'mumak-image-external-'));
    const staleLink = path.join(staging, '123e4567-e89b-42d3-a456-426614174002');
    const ignoredName = path.join(staging, 'not-a-server-uuid');
    await mkdir(staging);
    await Promise.all([mkdir(staleStage), mkdir(recentStage), mkdir(ignoredName)]);
    await symlink(external, staleLink, 'dir');
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await Promise.all([utimes(staleStage, old, old), utimes(ignoredName, old, old)]);
    await lutimes(staleLink, old, old);

    try {
      await upload(jpeg);

      await expect(stat(staleStage)).rejects.toMatchObject({ code: 'ENOENT' });
      await expect(stat(staleLink)).rejects.toMatchObject({ code: 'ENOENT' });
      await expect(stat(external)).resolves.toBeDefined();
      await expect(stat(recentStage)).resolves.toBeDefined();
      await expect(stat(ignoredName)).resolves.toBeDefined();
    } finally {
      await rm(external, { recursive: true, force: true });
    }
  });

  it('rejects a concurrent upload instead of queueing it', async () => {
    let enqueue: ((chunk: Uint8Array) => void) | undefined;
    let finish: (() => void) | undefined;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        enqueue = chunk => controller.enqueue(chunk);
        finish = () => controller.close();
      },
    });
    enqueue?.(jpeg.subarray(0, 3));
    const first = processImageUpload({
      body,
      storageRoot,
      minFreeBytes: 0,
      verifyPublic: async () => undefined,
    });
    await waitFor(async () => (await readdir(path.join(storageRoot, '.staging'))).length === 1);

    await expect(upload(jpeg)).rejects.toMatchObject({ code: 'upload_busy' });

    enqueue?.(jpeg.subarray(3));
    finish?.();
    await first;
  });

  it('cleans staging after a timed-out stream', async () => {
    const body = new ReadableStream<Uint8Array>();

    await expect(
      processImageUpload({
        body,
        storageRoot,
        minFreeBytes: 0,
        limits: { timeoutMs: 10 },
        verifyPublic: async () => undefined,
      })
    ).rejects.toMatchObject({ code: 'upload_timeout' });

    expect(await readdir(path.join(storageRoot, '.staging'))).toEqual([]);
  });

  it('reports public verification failure only after atomically committing the asset', async () => {
    await expect(
      upload(jpeg, {
        verifyPublic: async () => {
          throw new Error('origin unavailable');
        },
      })
    ).rejects.toMatchObject({ code: 'public_verification_failed' });

    const [assetId] = await readdir(path.join(storageRoot, 'published'));
    expect(await readdir(path.join(storageRoot, 'published', assetId!, 'content-v1'))).toEqual(
      expect.arrayContaining(['image.jpg', 'image.webp'])
    );
  });

  it('verifies both public renditions by MIME, length, and checksum before succeeding', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async input => {
      const url = new URL(String(input));
      const assetId = url.pathname.split('/')[2]!;
      const isWebp = url.pathname.endsWith('.webp');
      const bytes = await readFile(isWebp ? paths(assetId).webp : paths(assetId).jpeg);
      return new Response(new Uint8Array(bytes), {
        headers: { 'Content-Type': isWebp ? 'image/webp' : 'image/jpeg' },
      });
    });

    await expect(upload(jpeg, { verifyPublic: undefined })).resolves.toMatchObject({ duplicate: false });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    for (const [, options] of fetchSpy.mock.calls) {
      expect(options).toMatchObject({ method: 'GET', cache: 'no-store', redirect: 'error' });
    }
  });

  it('rejects public responses with wrong status, MIME, length, checksum, or transport errors', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input, _options) => {
      const url = new URL(String(input));
      const assetId = url.pathname.split('/')[2]!;
      const bytes = new Uint8Array(await readFile(paths(assetId).jpeg));
      const attempt = fetchSpy.mock.calls.length;

      if (attempt === 1) return new Response(bytes, { headers: { 'Content-Type': 'text/plain' } });
      if (attempt === 2) {
        return new Response(bytes.subarray(0, bytes.byteLength - 1), {
          headers: { 'Content-Type': 'image/jpeg' },
        });
      }
      if (attempt === 3) {
        const changed = bytes.slice();
        changed[0] = (changed[0] ?? 0) ^ 1;
        return new Response(changed, { headers: { 'Content-Type': 'image/jpeg' } });
      }
      if (attempt === 4) {
        return new Response(null, { headers: { 'Content-Type': 'image/jpeg' } });
      }
      if (attempt === 5) return new Response(null, { status: 302 });
      if (attempt === 6) throw new DOMException('aborted', 'AbortError');
      if (attempt === 7) {
        const tooLarge = new Uint8Array(bytes.byteLength + 1);
        tooLarge.set(bytes);
        return new Response(tooLarge, { headers: { 'Content-Type': 'image/jpeg' } });
      }
      return new Response(bytes.subarray(0, bytes.byteLength - 1), {
        headers: { 'Content-Type': 'image/jpeg' },
      });
    });

    await expect(upload(jpeg, { verifyPublic: undefined })).rejects.toMatchObject({
      code: 'public_verification_failed',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(10);
    const [assetId] = await readdir(path.join(storageRoot, 'published'));
    expect(await readdir(path.join(storageRoot, 'published', assetId!, 'content-v1'))).toEqual(
      expect.arrayContaining(['image.jpg', 'image.webp'])
    );
  }, 15_000);

  it('stops on a committed rendition corruption without overwriting it', async () => {
    const first = await upload(jpeg);
    const corruptedJpeg = paths(first.assetId).jpeg;
    const before = await readFile(corruptedJpeg);
    await open(corruptedJpeg, 'w').then(async file => {
      await file.writeFile('corrupt');
      await file.close();
    });

    await expect(upload(jpeg)).rejects.toMatchObject({ code: 'corruption' });
    expect(await readFile(corruptedJpeg)).not.toEqual(before);
    expect((await readFile(corruptedJpeg)).toString()).toBe('corrupt');
  });

  it('reports a committed public asset without its private record as corruption', async () => {
    const first = await upload(jpeg);
    await rm(path.join(storageRoot, 'private', first.assetId), { recursive: true });

    await expect(upload(jpeg)).rejects.toMatchObject({ code: 'corruption' });
    await expect(stat(paths(first.assetId).jpeg)).resolves.toBeDefined();
  });

  it('rejects a malformed committed manifest without rewriting the asset', async () => {
    const first = await upload(jpeg);
    await writeFile(paths(first.assetId).manifest, '{}\n');

    await expect(upload(jpeg)).rejects.toMatchObject({ code: 'corruption' });
    await expect(stat(paths(first.assetId).jpeg)).resolves.toBeDefined();
  });

  it('treats unexpected files beside a committed asset as corruption', async () => {
    const first = await upload(jpeg);
    await writeExclusive(path.join(storageRoot, 'private', first.assetId, 'unexpected'), new Uint8Array([1]));

    await expect(upload(jpeg)).rejects.toMatchObject({ code: 'corruption' });
    await expect(stat(paths(first.assetId).jpeg)).resolves.toBeDefined();
  });

  it('classifies a changed committed source as corruption before duplicate comparison', async () => {
    const first = await upload(jpeg);
    await sharp({ create: { width: 20, height: 10, channels: 3, background: '#ffffff' } })
      .jpeg({ quality: 95, chromaSubsampling: '4:4:4', progressive: false, mozjpeg: false })
      .toFile(paths(first.assetId).source);

    await expect(upload(jpeg)).rejects.toMatchObject({ code: 'corruption' });
  });

  it('stops an interrupted claim whose stored source differs from the incoming canonical bytes', async () => {
    const first = await upload(jpeg);
    const locations = paths(first.assetId);
    await rm(path.join(storageRoot, 'published', first.assetId), { recursive: true });
    await rm(locations.manifest);
    await sharp({ create: { width: 20, height: 10, channels: 3, background: '#ffffff' } })
      .jpeg()
      .toFile(locations.source);

    await expect(upload(jpeg)).rejects.toMatchObject({ code: 'collision' });
  });

  async function upload(
    bytes: Uint8Array,
    overrides: Partial<Parameters<typeof processImageUpload>[0]> = {}
  ): Promise<ImageUploadResult> {
    return await processImageUpload({
      body: bytesToStream(bytes),
      storageRoot,
      minFreeBytes: 0,
      verifyPublic: async () => undefined,
      ...overrides,
    });
  }

  function paths(assetId: string) {
    return {
      source: path.join(storageRoot, 'private', assetId, 'source.jpg'),
      manifest: path.join(storageRoot, 'private', assetId, 'manifest.json'),
      jpeg: path.join(storageRoot, 'published', assetId, 'content-v1', 'image.jpg'),
      webp: path.join(storageRoot, 'published', assetId, 'content-v1', 'image.webp'),
    };
  }
});

function bytesToStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

async function readManifest(manifestPath: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
}

async function sha256(filePath: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(filePath))
    .digest('hex');
}

async function writeExclusive(filePath: string, bytes: Uint8Array): Promise<void> {
  const file = await open(filePath, 'wx', 0o600);
  await file.writeFile(bytes);
  await file.close();
}

async function expectWorldReadable(filePath: string): Promise<void> {
  expect((await stat(filePath)).mode & 0o777).toBe(0o644);
}

async function waitFor(predicate: () => Promise<boolean>): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      if (await predicate()) return;
    } catch (error) {
      if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT')) {
        throw error;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error('condition not reached');
}

it('keeps typed upload failures inspectable by the route boundary', () => {
  expect(new ImageUploadError('payload_too_large')).toMatchObject({
    name: 'ImageUploadError',
    code: 'payload_too_large',
    message: 'payload_too_large',
  });
});
