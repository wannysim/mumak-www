import { createHash, randomUUID } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { chmod, lstat, mkdir, open, readdir, rename, rm, statfs, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const PUBLIC_BASE_URL = 'https://img.wannysim.com';
const MAX_UPLOAD_BYTES = 32 * 1024 * 1024;
const MAX_INPUT_PIXELS = 50_000_000;
const UPLOAD_TIMEOUT_MS = 120_000;
const STALE_STAGE_MS = 24 * 60 * 60 * 1000;
const PUBLIC_VERIFICATION_TIMEOUT_MS = 10_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ASSET_ID_PATTERN = /^[0-9a-f]{64}$/;
const PRIVATE_ENTRIES = new Set(['manifest.json', 'source.jpg']);
const PUBLIC_ASSET_ENTRIES = new Set(['content-v1']);
const CONTENT_ENTRIES = new Set(['image.jpg', 'image.webp']);

export type ImageUploadErrorCode =
  | 'collision'
  | 'corruption'
  | 'insufficient_storage'
  | 'invalid_configuration'
  | 'invalid_image'
  | 'missing_body'
  | 'payload_too_large'
  | 'pixel_limit_exceeded'
  | 'public_verification_failed'
  | 'storage_failure'
  | 'unsupported_media_type'
  | 'upload_aborted'
  | 'upload_busy'
  | 'upload_timeout';

type FileManifest = {
  sha256: string;
  bytes: number;
  width: number;
  height: number;
};

type ImageManifest = {
  schemaVersion: 1;
  assetId: string;
  canonicalPolicy: 'source-v1';
  source: FileManifest;
  processor: { sharp: string; libvips: string };
  variants: {
    'content-v1': {
      jpeg: FileManifest;
      webp: FileManifest;
    };
  };
};

type ImageUploadLimits = {
  maxBytes: number;
  maxPixels: number;
  timeoutMs: number;
};

type StorageCheckpoint =
  | 'after-canonical-write'
  | 'before-private-commit'
  | 'after-private-commit'
  | 'before-public-rename'
  | 'after-public-rename';

export type ImageUploadResult = {
  assetId: string;
  duplicate: boolean;
  width: number;
  height: number;
  urls: { jpeg: string; webp: string };
  checksums: { source: string; jpeg: string; webp: string };
  bytes: { source: number; jpeg: number; webp: number };
};

export type PublicImageVerifier = (result: ImageUploadResult) => Promise<void>;

export type ProcessImageUploadOptions = {
  body: ReadableStream<Uint8Array> | null;
  signal?: AbortSignal;
  storageRoot: string;
  minFreeBytes: number;
  limits?: Partial<ImageUploadLimits>;
  verifyPublic?: PublicImageVerifier;
  /** Tests only: simulates storage failure at a durable-write boundary. */
  onStorageCheckpoint?: (checkpoint: StorageCheckpoint) => void | Promise<void>;
};

export class ImageUploadError extends Error {
  readonly code: ImageUploadErrorCode;

  constructor(code: ImageUploadErrorCode, cause?: unknown) {
    super(code, cause === undefined ? undefined : { cause });
    this.name = 'ImageUploadError';
    this.code = code;
  }
}

let uploadInProgress = false;
sharp.concurrency(1);

export async function processImageUpload({
  body,
  signal,
  storageRoot,
  minFreeBytes,
  limits: limitOverrides,
  verifyPublic,
  onStorageCheckpoint,
}: ProcessImageUploadOptions): Promise<ImageUploadResult> {
  if (uploadInProgress) {
    throw new ImageUploadError('upload_busy');
  }

  uploadInProgress = true;
  let stageDirectory: string | undefined;
  let stagingRoot: string | undefined;

  try {
    const limits = resolveLimits(limitOverrides);
    assertConfiguration(storageRoot, minFreeBytes);
    const storage = await prepareStorage(storageRoot);
    stagingRoot = storage.staging;

    await cleanupStaleStages(storage.staging);
    await assertFreeSpace(storageRoot, minFreeBytes + limits.maxBytes);

    stageDirectory = path.join(storage.staging, randomUUID());
    await mkdir(stageDirectory, { mode: 0o700 });

    const inputPath = path.join(stageDirectory, 'input');
    await stageRequestBody(body, inputPath, limits, signal);
    await assertJpegMagic(inputPath);

    const canonicalPath = path.join(stageDirectory, 'source.jpg');
    const canonical = await createCanonicalSource(inputPath, canonicalPath, limits.maxPixels, onStorageCheckpoint);
    const assetId = canonical.sha256;
    const existing = await inspectExistingAsset(storage, assetId, canonicalPath);

    if (existing) {
      const result = toResult(existing, true);
      await runPublicVerification(verifyPublic, result, existing);
      return result;
    }

    const contentDirectory = path.join(stageDirectory, 'content-v1');
    await mkdir(contentDirectory, { mode: 0o755 });
    const jpeg = await createJpegVariant(canonicalPath, path.join(contentDirectory, 'image.jpg'));
    const webp = await createWebpVariant(canonicalPath, path.join(contentDirectory, 'image.webp'));

    if (jpeg.width !== webp.width || jpeg.height !== webp.height) {
      throw new ImageUploadError('storage_failure');
    }

    const manifest: ImageManifest = {
      schemaVersion: 1,
      assetId,
      canonicalPolicy: 'source-v1',
      source: canonical,
      processor: {
        sharp: sharp.versions.sharp,
        libvips: sharp.versions.vips,
      },
      variants: { 'content-v1': { jpeg, webp } },
    };
    const manifestPath = path.join(stageDirectory, 'manifest.json');

    await writeJsonFile(manifestPath, manifest, 0o600);
    await syncDirectory(contentDirectory);
    await syncDirectory(stageDirectory);
    await assertFreeSpace(storageRoot, minFreeBytes);
    await commitAsset(storage, stageDirectory, manifest, onStorageCheckpoint);

    const result = toResult(manifest, false);
    await runPublicVerification(verifyPublic, result, manifest);
    return result;
  } catch (error) {
    const failure = normalizeError(error);
    if (stageDirectory && stagingRoot) {
      try {
        await removeStage(stageDirectory, stagingRoot);
        stageDirectory = undefined;
      } catch (cleanupError) {
        throw new ImageUploadError('storage_failure', cleanupError);
      }
    }
    throw failure;
  } finally {
    try {
      if (stageDirectory && stagingRoot) {
        await removeStage(stageDirectory, stagingRoot);
      }
    } finally {
      uploadInProgress = false;
    }
  }
}

function resolveLimits(overrides: Partial<ImageUploadLimits> | undefined): ImageUploadLimits {
  const limits = {
    maxBytes: Math.min(overrides?.maxBytes ?? MAX_UPLOAD_BYTES, MAX_UPLOAD_BYTES),
    maxPixels: Math.min(overrides?.maxPixels ?? MAX_INPUT_PIXELS, MAX_INPUT_PIXELS),
    timeoutMs: Math.min(overrides?.timeoutMs ?? UPLOAD_TIMEOUT_MS, UPLOAD_TIMEOUT_MS),
  };

  if (Object.values(limits).some(value => !Number.isSafeInteger(value) || value <= 0)) {
    throw new ImageUploadError('invalid_configuration');
  }

  return limits;
}

function assertConfiguration(storageRoot: string, minFreeBytes: number): void {
  if (!path.isAbsolute(storageRoot) || !Number.isSafeInteger(minFreeBytes) || minFreeBytes < 0) {
    throw new ImageUploadError('invalid_configuration');
  }
}

async function prepareStorage(storageRoot: string) {
  await ensureStorageRoot(storageRoot);
  const staging = path.join(storageRoot, '.staging');
  const privateRoot = path.join(storageRoot, 'private');
  const publishedRoot = path.join(storageRoot, 'published');

  await ensureDirectory(staging, 0o700);
  await ensureDirectory(privateRoot, 0o700);
  await ensureDirectory(publishedRoot, 0o755);
  await syncDirectory(storageRoot);

  return { staging, privateRoot, publishedRoot };
}

async function ensureStorageRoot(storageRoot: string): Promise<void> {
  const metadata = await lstat(storageRoot).catch((error: unknown) => {
    if (isNodeError(error, 'ENOENT')) return undefined;
    throw error;
  });

  if (!metadata) {
    await mkdir(storageRoot, { recursive: true, mode: 0o700 });
    const created = await lstat(storageRoot);
    if (!created.isDirectory() || created.isSymbolicLink()) throw new ImageUploadError('storage_failure');
    return;
  }

  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new ImageUploadError('storage_failure');
  }
}

async function ensureDirectory(directory: string, mode: number): Promise<void> {
  await mkdir(directory, { mode }).catch((error: unknown) => {
    if (!isNodeError(error, 'EEXIST')) throw error;
  });
  const metadata = await lstat(directory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new ImageUploadError('storage_failure');
  }
}

async function cleanupStaleStages(stagingRoot: string): Promise<void> {
  const cutoff = Date.now() - STALE_STAGE_MS;
  let removed = false;

  for (const entry of await readdir(stagingRoot)) {
    if (!UUID_PATTERN.test(entry)) continue;
    const target = path.join(stagingRoot, entry);
    const metadata = await lstat(target).catch((error: unknown) => {
      if (isNodeError(error, 'ENOENT')) return undefined;
      throw error;
    });

    if (!metadata || metadata.mtimeMs >= cutoff) continue;
    if (metadata.isSymbolicLink()) {
      await unlink(target);
      removed = true;
    } else if (metadata.isDirectory()) {
      await rm(target, { recursive: true });
      removed = true;
    }
  }

  if (removed) await syncDirectory(stagingRoot);
}

async function removeStage(stageDirectory: string, stagingRoot: string): Promise<void> {
  await rm(stageDirectory, { recursive: true, force: true });
  await syncDirectory(stagingRoot);
}

async function assertFreeSpace(storageRoot: string, requiredBytes: number): Promise<void> {
  const storageStats = await statfs(storageRoot, { bigint: true });
  const availableBytes = storageStats.bavail * storageStats.bsize;

  if (availableBytes < BigInt(requiredBytes)) {
    throw new ImageUploadError('insufficient_storage');
  }
}

async function stageRequestBody(
  body: ReadableStream<Uint8Array> | null,
  destination: string,
  limits: ImageUploadLimits,
  signal: AbortSignal | undefined
): Promise<void> {
  if (!body) throw new ImageUploadError('missing_body');

  const reader = body.getReader();
  const destinationFile = await open(
    destination,
    fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW | fsConstants.O_WRONLY,
    0o600
  );
  const deadline = Date.now() + limits.timeoutMs;
  let receivedBytes = 0;

  try {
    while (true) {
      const { done, value } = await readBeforeDeadline(reader, deadline, signal);
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new ImageUploadError('invalid_image');

      receivedBytes += value.byteLength;
      if (receivedBytes > limits.maxBytes) {
        throw new ImageUploadError('payload_too_large');
      }

      await writeAll(destinationFile, value);
    }

    if (receivedBytes === 0) throw new ImageUploadError('invalid_image');
    await destinationFile.sync();
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
    await destinationFile.close();
  }
}

async function readBeforeDeadline(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  deadline: number,
  signal: AbortSignal | undefined
): Promise<ReadableStreamReadResult<Uint8Array>> {
  if (signal?.aborted) throw new ImageUploadError('upload_aborted');
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) throw new ImageUploadError('upload_timeout');

  let timeout: ReturnType<typeof setTimeout> | undefined;
  let abortHandler: (() => void) | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new ImageUploadError('upload_timeout')), remainingMs);
  });
  const abortPromise = new Promise<never>((_, reject) => {
    if (!signal) return;
    abortHandler = () => reject(new ImageUploadError('upload_aborted'));
    signal.addEventListener('abort', abortHandler, { once: true });
  });

  try {
    return await Promise.race([reader.read(), timeoutPromise, abortPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
    if (signal && abortHandler) signal.removeEventListener('abort', abortHandler);
  }
}

async function writeAll(file: Awaited<ReturnType<typeof open>>, bytes: Uint8Array): Promise<void> {
  let offset = 0;

  while (offset < bytes.byteLength) {
    const { bytesWritten } = await file.write(bytes, offset, bytes.byteLength - offset);
    if (bytesWritten === 0) throw new ImageUploadError('storage_failure');
    offset += bytesWritten;
  }
}

async function assertJpegMagic(inputPath: string): Promise<void> {
  const input = await open(inputPath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  const signature = Buffer.alloc(3);

  try {
    const { bytesRead } = await input.read(signature, 0, signature.byteLength, 0);
    if (bytesRead !== 3 || signature[0] !== 0xff || signature[1] !== 0xd8 || signature[2] !== 0xff) {
      throw new ImageUploadError('unsupported_media_type');
    }
  } finally {
    await input.close();
  }
}

async function createCanonicalSource(
  inputPath: string,
  destination: string,
  maxPixels: number,
  onCheckpoint?: (checkpoint: StorageCheckpoint) => void | Promise<void>
): Promise<FileManifest> {
  try {
    const options = { failOn: 'warning' as const, limitInputPixels: maxPixels, pages: 1 };
    const inputMetadata = await sharp(inputPath, options).metadata();

    if (inputMetadata.format !== 'jpeg') throw new ImageUploadError('unsupported_media_type');
    if ((inputMetadata.pages ?? 1) !== 1) throw new ImageUploadError('unsupported_media_type');
    if (!inputMetadata.width || !inputMetadata.height) throw new ImageUploadError('invalid_image');
    if (inputMetadata.width * inputMetadata.height > maxPixels) {
      throw new ImageUploadError('pixel_limit_exceeded');
    }

    const info = await sharp(inputPath, options)
      .autoOrient()
      .toColourspace('srgb')
      .jpeg({
        quality: 95,
        chromaSubsampling: '4:4:4',
        progressive: false,
        mozjpeg: false,
        optimiseCoding: true,
      })
      .toFile(destination);

    await onCheckpoint?.('after-canonical-write');
    await chmod(destination, 0o600);
    await syncFile(destination);
    return await describeOutput(destination, info.width, info.height);
  } catch (error) {
    if (error instanceof ImageUploadError) throw error;
    if (isCapacityError(error)) throw error;
    if (/pixel limit|exceeds? .*pixels?/i.test(errorMessage(error))) {
      throw new ImageUploadError('pixel_limit_exceeded', error);
    }
    throw new ImageUploadError('invalid_image', error);
  }
}

async function createJpegVariant(source: string, destination: string): Promise<FileManifest> {
  const info = await sharp(source, { failOn: 'warning', limitInputPixels: MAX_INPUT_PIXELS, pages: 1 })
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({
      quality: 82,
      chromaSubsampling: '4:2:0',
      progressive: true,
      mozjpeg: false,
      optimiseCoding: true,
    })
    .toFile(destination);

  await chmod(destination, 0o644);
  await syncFile(destination);
  return await describeOutput(destination, info.width, info.height);
}

async function createWebpVariant(source: string, destination: string): Promise<FileManifest> {
  const info = await sharp(source, { failOn: 'warning', limitInputPixels: MAX_INPUT_PIXELS, pages: 1 })
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 79, effort: 4, lossless: false, smartSubsample: true })
    .toFile(destination);

  await chmod(destination, 0o644);
  await syncFile(destination);
  return await describeOutput(destination, info.width, info.height);
}

async function describeOutput(filePath: string, width: number, height: number): Promise<FileManifest> {
  const { sha256, bytes } = await hashFile(filePath);
  return { sha256, bytes, width, height };
}

async function writeJsonFile(filePath: string, value: unknown, mode: number): Promise<void> {
  const file = await open(
    filePath,
    fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW | fsConstants.O_WRONLY,
    mode
  );

  try {
    await file.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await file.sync();
  } finally {
    await file.close();
  }
}

async function inspectExistingAsset(
  storage: Awaited<ReturnType<typeof prepareStorage>>,
  assetId: string,
  incomingCanonicalPath: string
): Promise<ImageManifest | undefined> {
  const privateDirectory = path.join(storage.privateRoot, assetId);
  const publishedDirectory = path.join(storage.publishedRoot, assetId);
  const contentDirectory = path.join(publishedDirectory, 'content-v1');
  const [hasPrivateClaim, hasPublishedClaim, hasCommitPoint] = await Promise.all([
    directoryExists(privateDirectory),
    directoryExists(publishedDirectory),
    directoryExists(contentDirectory),
  ]);

  if (hasCommitPoint) {
    try {
      await assertExactEntries(privateDirectory, PRIVATE_ENTRIES);
      await assertExactEntries(publishedDirectory, PUBLIC_ASSET_ENTRIES);
      await assertExactEntries(contentDirectory, CONTENT_ENTRIES);
      const manifest = await validateCommittedAsset(privateDirectory, contentDirectory, assetId);
      if (!(await filesEqual(path.join(privateDirectory, 'source.jpg'), incomingCanonicalPath))) {
        throw new ImageUploadError('collision');
      }
      return manifest;
    } catch (error) {
      if (error instanceof ImageUploadError) throw error;
      throw new ImageUploadError('corruption', error);
    }
  }

  if (hasPublishedClaim) {
    const entries = await readdir(publishedDirectory);
    if (entries.length > 0) throw new ImageUploadError('corruption');
  }

  if (hasPrivateClaim) {
    const entries = await readdir(privateDirectory);
    if (entries.some(entry => entry !== 'source.jpg' && entry !== 'manifest.json')) {
      throw new ImageUploadError('corruption');
    }

    if (entries.includes('source.jpg')) {
      const storedSource = path.join(privateDirectory, 'source.jpg');
      await assertRegularFile(storedSource, 'corruption');
      if (!(await filesEqual(storedSource, incomingCanonicalPath))) {
        throw new ImageUploadError('collision');
      }
    }
  }

  if (hasPrivateClaim) {
    await rm(privateDirectory, { recursive: true });
    await syncDirectory(storage.privateRoot);
  }
  if (hasPublishedClaim) {
    await rm(publishedDirectory, { recursive: true });
    await syncDirectory(storage.publishedRoot);
  }
  return undefined;
}

async function validateCommittedAsset(
  privateDirectory: string,
  contentDirectory: string,
  assetId: string
): Promise<ImageManifest> {
  try {
    const sourcePath = path.join(privateDirectory, 'source.jpg');
    const manifestPath = path.join(privateDirectory, 'manifest.json');
    const jpegPath = path.join(contentDirectory, 'image.jpg');
    const webpPath = path.join(contentDirectory, 'image.webp');

    await Promise.all([
      assertRegularFile(sourcePath, 'corruption'),
      assertRegularFile(manifestPath, 'corruption'),
      assertRegularFile(jpegPath, 'corruption'),
      assertRegularFile(webpPath, 'corruption'),
    ]);

    const manifest = JSON.parse(await readUtf8(manifestPath)) as unknown;
    if (!isImageManifest(manifest) || manifest.assetId !== assetId || manifest.source.sha256 !== assetId) {
      throw new ImageUploadError('corruption');
    }

    const [source, jpeg, webp] = await Promise.all([
      inspectStoredImage(sourcePath, 'jpeg'),
      inspectStoredImage(jpegPath, 'jpeg'),
      inspectStoredImage(webpPath, 'webp'),
    ]);

    assertFileManifestMatches(source, manifest.source);
    assertFileManifestMatches(jpeg, manifest.variants['content-v1'].jpeg);
    assertFileManifestMatches(webp, manifest.variants['content-v1'].webp);
    if (jpeg.width !== webp.width || jpeg.height !== webp.height) {
      throw new ImageUploadError('corruption');
    }

    return manifest;
  } catch (error) {
    if (error instanceof ImageUploadError) throw error;
    throw new ImageUploadError('corruption', error);
  }
}

async function assertExactEntries(directory: string, expected: ReadonlySet<string>): Promise<void> {
  const entries = await readdir(directory);
  if (entries.length !== expected.size || entries.some(entry => !expected.has(entry))) {
    throw new ImageUploadError('corruption');
  }
}

async function inspectStoredImage(filePath: string, expectedFormat: 'jpeg' | 'webp'): Promise<FileManifest> {
  const [file, metadata] = await Promise.all([hashFile(filePath), sharp(filePath).metadata()]);
  if (
    metadata.format !== expectedFormat ||
    !metadata.width ||
    !metadata.height ||
    metadata.exif ||
    metadata.icc ||
    metadata.xmp ||
    metadata.orientation
  ) {
    throw new ImageUploadError('corruption');
  }
  return { ...file, width: metadata.width, height: metadata.height };
}

function assertFileManifestMatches(actual: FileManifest, expected: FileManifest): void {
  if (
    actual.sha256 !== expected.sha256 ||
    actual.bytes !== expected.bytes ||
    actual.width !== expected.width ||
    actual.height !== expected.height
  ) {
    throw new ImageUploadError('corruption');
  }
}

async function commitAsset(
  storage: Awaited<ReturnType<typeof prepareStorage>>,
  stageDirectory: string,
  manifest: ImageManifest,
  onCheckpoint?: (checkpoint: StorageCheckpoint) => void | Promise<void>
): Promise<void> {
  if (!ASSET_ID_PATTERN.test(manifest.assetId)) throw new ImageUploadError('storage_failure');
  const privateDirectory = path.join(storage.privateRoot, manifest.assetId);
  const publishedDirectory = path.join(storage.publishedRoot, manifest.assetId);

  await mkdir(privateDirectory, { mode: 0o700 });
  await mkdir(publishedDirectory, { mode: 0o755 });
  await onCheckpoint?.('before-private-commit');
  await rename(path.join(stageDirectory, 'source.jpg'), path.join(privateDirectory, 'source.jpg'));
  await rename(path.join(stageDirectory, 'manifest.json'), path.join(privateDirectory, 'manifest.json'));
  await syncDirectory(privateDirectory);
  await syncDirectory(storage.privateRoot);

  await onCheckpoint?.('after-private-commit');
  await onCheckpoint?.('before-public-rename');
  await rename(path.join(stageDirectory, 'content-v1'), path.join(publishedDirectory, 'content-v1'));
  await onCheckpoint?.('after-public-rename');
  await syncDirectory(publishedDirectory);
  await syncDirectory(storage.publishedRoot);
}

function toResult(manifest: ImageManifest, duplicate: boolean): ImageUploadResult {
  const variant = manifest.variants['content-v1'];
  const prefix = `${PUBLIC_BASE_URL}/blog/${manifest.assetId}/content-v1`;

  return {
    assetId: manifest.assetId,
    duplicate,
    width: variant.jpeg.width,
    height: variant.jpeg.height,
    urls: { jpeg: `${prefix}/image.jpg`, webp: `${prefix}/image.webp` },
    checksums: {
      source: manifest.source.sha256,
      jpeg: variant.jpeg.sha256,
      webp: variant.webp.sha256,
    },
    bytes: {
      source: manifest.source.bytes,
      jpeg: variant.jpeg.bytes,
      webp: variant.webp.bytes,
    },
  };
}

async function runPublicVerification(
  verifyPublic: PublicImageVerifier | undefined,
  result: ImageUploadResult,
  manifest: ImageManifest
): Promise<void> {
  try {
    await (verifyPublic ? verifyPublic(result) : verifyPublicImages(result, manifest));
  } catch (error) {
    if (error instanceof ImageUploadError && error.code === 'public_verification_failed') throw error;
    throw new ImageUploadError('public_verification_failed', error);
  }
}

async function verifyPublicImages(result: ImageUploadResult, manifest: ImageManifest): Promise<void> {
  let lastError: unknown;
  const variants = manifest.variants['content-v1'];

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      await verifyPublicFile(result.urls.jpeg, result.checksums.jpeg, variants.jpeg.bytes, 'image/jpeg');
      await verifyPublicFile(result.urls.webp, result.checksums.webp, variants.webp.bytes, 'image/webp');
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 10) await delay(attempt * 100);
    }
  }

  throw new ImageUploadError('public_verification_failed', lastError);
}

async function verifyPublicFile(
  url: string,
  expectedHash: string,
  expectedBytes: number,
  expectedType: string
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PUBLIC_VERIFICATION_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
  if (!response.ok || response.headers.get('content-type')?.split(';', 1)[0] !== expectedType || !response.body) {
    clearTimeout(timeout);
    throw new Error('public response mismatch');
  }

  const digest = createHash('sha256');
  const reader = response.body.getReader();
  let receivedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > expectedBytes) {
        await reader.cancel();
        throw new Error('public response too large');
      }
      digest.update(value);
    }
  } finally {
    clearTimeout(timeout);
  }
  if (receivedBytes !== expectedBytes) throw new Error('public response length mismatch');
  if (digest.digest('hex') !== expectedHash) throw new Error('public checksum mismatch');
}

async function hashFile(filePath: string): Promise<{ sha256: string; bytes: number }> {
  const digest = createHash('sha256');
  const file = await open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  const buffer = Buffer.allocUnsafe(64 * 1024);
  let bytes = 0;

  try {
    while (true) {
      const { bytesRead } = await file.read(buffer, 0, buffer.byteLength, bytes);
      if (bytesRead === 0) break;
      digest.update(buffer.subarray(0, bytesRead));
      bytes += bytesRead;
    }
  } finally {
    await file.close();
  }

  return { sha256: digest.digest('hex'), bytes };
}

async function filesEqual(leftPath: string, rightPath: string): Promise<boolean> {
  const [left, right] = await Promise.all([
    open(leftPath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW),
    open(rightPath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW),
  ]);
  const leftBuffer = Buffer.allocUnsafe(64 * 1024);
  const rightBuffer = Buffer.allocUnsafe(64 * 1024);

  try {
    let position = 0;
    while (true) {
      const [leftRead, rightRead] = await Promise.all([
        left.read(leftBuffer, 0, leftBuffer.byteLength, position),
        right.read(rightBuffer, 0, rightBuffer.byteLength, position),
      ]);
      if (leftRead.bytesRead !== rightRead.bytesRead) return false;
      if (leftRead.bytesRead === 0) return true;
      if (!leftBuffer.subarray(0, leftRead.bytesRead).equals(rightBuffer.subarray(0, rightRead.bytesRead))) {
        return false;
      }
      position += leftRead.bytesRead;
    }
  } finally {
    await Promise.all([left.close(), right.close()]);
  }
}

async function directoryExists(directory: string): Promise<boolean> {
  let metadata: Awaited<ReturnType<typeof lstat>>;
  try {
    metadata = await lstat(directory);
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) return false;
    throw error;
  }
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new ImageUploadError('corruption');
  return true;
}

async function assertRegularFile(filePath: string, errorCode: ImageUploadErrorCode): Promise<void> {
  let metadata: Awaited<ReturnType<typeof lstat>>;
  try {
    metadata = await lstat(filePath);
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) throw new ImageUploadError(errorCode);
    throw error;
  }
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw new ImageUploadError(errorCode);
}

async function readUtf8(filePath: string): Promise<string> {
  const file = await open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    return await file.readFile('utf8');
  } finally {
    await file.close();
  }
}

async function syncFile(filePath: string): Promise<void> {
  const file = await open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    await file.sync();
  } finally {
    await file.close();
  }
}

async function syncDirectory(directory: string): Promise<void> {
  const handle = await open(directory, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    await handle.sync();
  } catch (error) {
    if (!isNodeError(error, 'EINVAL') && !isNodeError(error, 'ENOTSUP')) throw error;
  } finally {
    await handle.close();
  }
}

function isImageManifest(value: unknown): value is ImageManifest {
  if (!isRecord(value) || !isRecord(value.processor) || !isRecord(value.variants)) return false;
  const content = value.variants['content-v1'];

  return (
    value.schemaVersion === 1 &&
    isSha256(value.assetId) &&
    value.canonicalPolicy === 'source-v1' &&
    isFileManifest(value.source) &&
    typeof value.processor.sharp === 'string' &&
    value.processor.sharp.length > 0 &&
    typeof value.processor.libvips === 'string' &&
    value.processor.libvips.length > 0 &&
    isRecord(content) &&
    isFileManifest(content.jpeg) &&
    isFileManifest(content.webp)
  );
}

function isFileManifest(value: unknown): value is FileManifest {
  return (
    isRecord(value) &&
    isSha256(value.sha256) &&
    isPositiveSafeInteger(value.bytes) &&
    isPositiveSafeInteger(value.width) &&
    isPositiveSafeInteger(value.height)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && ASSET_ID_PATTERN.test(value);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function normalizeError(error: unknown): ImageUploadError {
  if (error instanceof ImageUploadError) return error;
  if (isCapacityError(error)) {
    return new ImageUploadError('insufficient_storage', error);
  }
  return new ImageUploadError('storage_failure', error);
}

function isCapacityError(error: unknown): boolean {
  return (
    isNodeError(error, 'ENOSPC') ||
    isNodeError(error, 'EDQUOT') ||
    /no space left on device|disk quota exceeded/i.test(errorMessage(error))
  );
}

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return isRecord(error) && error.code === code;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '';
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}
