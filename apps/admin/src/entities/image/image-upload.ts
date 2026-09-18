import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { chmod, mkdtemp, open, rm, statfs, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const PUBLIC_BASE_URL = 'https://img.wannysim.com';
const MAX_UPLOAD_BYTES = 32 * 1024 * 1024;
const MAX_INPUT_PIXELS = 50_000_000;
const PUBLIC_VERIFICATION_TIMEOUT_MS = 10_000;
const ASSET_ID_PATTERN = /^[0-9a-f]{64}$/;

export type ImageUploadErrorCode =
  | 'animated_image'
  | 'collision'
  | 'corruption'
  | 'insufficient_storage'
  | 'invalid_configuration'
  | 'invalid_image'
  | 'payload_too_large'
  | 'pixel_limit_exceeded'
  | 'public_verification_failed'
  | 'storage_failure'
  | 'unsupported_media_type'
  | 'upload_busy';

type FileManifest = {
  sha256: string;
  bytes: number;
  width: number;
  height: number;
};

export type ImageManifest = {
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

export type PreparedImage = {
  manifest: ImageManifest;
  files: { source: string; jpeg: string; webp: string };
};

export class ImageUploadError extends Error {
  readonly code: ImageUploadErrorCode;

  constructor(code: ImageUploadErrorCode, cause?: unknown) {
    super(code, cause === undefined ? undefined : { cause });
    this.name = 'ImageUploadError';
    this.code = code;
  }
}

// 한 런타임 인스턴스 안에서만 유효한 잠금이다. 동시 sharp 실행으로 native peak memory가
// 겹치는 것을 막는 용도이고, 서버리스에서 인스턴스 사이의 직렬화는 보장하지 않는다.
// 전역 직렬화는 R2 장부의 admission 최소 간격이 담당한다.
let uploadInProgress = false;
sharp.concurrency(1);

export async function withPreparedImage<T>(
  input: Buffer,
  consume: (image: PreparedImage) => Promise<T>,
  limits: { maxBytes?: number; maxPixels?: number } = {}
): Promise<T> {
  if (uploadInProgress) throw new ImageUploadError('upload_busy');
  uploadInProgress = true;
  let directory: string | undefined;
  try {
    let prepared: PreparedImage;
    try {
      const maxBytes = Math.min(limits.maxBytes ?? MAX_UPLOAD_BYTES, MAX_UPLOAD_BYTES);
      const maxPixels = Math.min(limits.maxPixels ?? MAX_INPUT_PIXELS, MAX_INPUT_PIXELS);
      if (![maxBytes, maxPixels].every(value => Number.isSafeInteger(value) && value > 0))
        throw new ImageUploadError('invalid_configuration');
      if (!input.length) throw new ImageUploadError('invalid_image');
      if (input.length > maxBytes) throw new ImageUploadError('payload_too_large');
      if (!hasSupportedSignature(input)) throw new ImageUploadError('unsupported_media_type');
      directory = await mkdtemp(path.join(tmpdir(), 'mumak-image-'));
      await assertFreeSpace(directory, 128 * 1024 * 1024 + input.length);
      const inputPath = path.join(directory, 'input');
      await writeFile(inputPath, input, { flag: 'wx', mode: 0o600 });
      const files = {
        source: path.join(directory, 'source.jpg'),
        jpeg: path.join(directory, 'image.jpg'),
        webp: path.join(directory, 'image.webp'),
      };
      const source = await createCanonicalSource(inputPath, files.source, maxPixels);
      const jpeg = await createJpegVariant(files.source, files.jpeg);
      const webp = await createWebpVariant(files.source, files.webp);
      if (jpeg.width !== webp.width || jpeg.height !== webp.height) throw new ImageUploadError('storage_failure');
      prepared = {
        files,
        manifest: {
          schemaVersion: 1,
          assetId: source.sha256,
          canonicalPolicy: 'source-v1',
          source,
          processor: { sharp: sharp.versions.sharp, libvips: sharp.versions.vips },
          variants: { 'content-v1': { jpeg, webp } },
        },
      };
    } catch (error) {
      throw normalizeError(error);
    }
    return await consume(prepared);
  } finally {
    try {
      if (directory) await rm(directory, { recursive: true, force: true });
    } finally {
      uploadInProgress = false;
    }
  }
}

function hasSupportedSignature(input: Buffer): boolean {
  if (input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff) return true;
  if (input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    // APNG is not decoded as animation by every libvips build.
    for (let offset = 8; offset + 12 <= input.length;) {
      if (input.toString('ascii', offset + 4, offset + 8) === 'acTL') throw new ImageUploadError('animated_image');
      offset += 12 + input.readUInt32BE(offset);
    }
    return true;
  }
  if (/^GIF8[79]a$/.test(input.toString('ascii', 0, 6))) return true;
  if (input.toString('ascii', 0, 4) === 'RIFF' && input.toString('ascii', 8, 12) === 'WEBP') return true;
  if (input.toString('ascii', 4, 8) !== 'ftyp' || input.length < 16) return false;
  const boxEnd = Math.min(input.readUInt32BE(0), input.length, 256);
  for (let offset = 8; offset + 4 <= boxEnd; offset += 4) {
    if (offset === 12) continue;
    if (['avif', 'avis'].includes(input.toString('ascii', offset, offset + 4))) return true;
  }
  return false;
}

async function assertFreeSpace(storageRoot: string, requiredBytes: number): Promise<void> {
  const storageStats = await statfs(storageRoot, { bigint: true });
  const availableBytes = storageStats.bavail * storageStats.bsize;

  if (availableBytes < BigInt(requiredBytes)) {
    throw new ImageUploadError('insufficient_storage');
  }
}

async function createCanonicalSource(inputPath: string, destination: string, maxPixels: number): Promise<FileManifest> {
  try {
    const options = { failOn: 'warning' as const, limitInputPixels: maxPixels, pages: 1 };
    const inputMetadata = await sharp(inputPath, options).metadata();

    const supported =
      ['jpeg', 'png', 'webp', 'gif'].includes(inputMetadata.format ?? '') ||
      (inputMetadata.format === 'heif' && inputMetadata.compression === 'av1');
    if (!supported) throw new ImageUploadError('unsupported_media_type');
    if ((inputMetadata.pages ?? 1) !== 1) throw new ImageUploadError('animated_image');
    if (!inputMetadata.width || !inputMetadata.height) throw new ImageUploadError('invalid_image');
    if (inputMetadata.width * inputMetadata.height > maxPixels) {
      throw new ImageUploadError('pixel_limit_exceeded');
    }

    const info = await sharp(inputPath, options)
      .autoOrient()
      .toColourspace('srgb')
      .flatten({ background: '#ffffff' })
      .jpeg({
        quality: 95,
        chromaSubsampling: '4:4:4',
        progressive: false,
        mozjpeg: false,
        optimiseCoding: true,
      })
      .toFile(destination);

    await chmod(destination, 0o600);
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
  return await describeOutput(destination, info.width, info.height);
}

async function createWebpVariant(source: string, destination: string): Promise<FileManifest> {
  const info = await sharp(source, { failOn: 'warning', limitInputPixels: MAX_INPUT_PIXELS, pages: 1 })
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 79, effort: 4, lossless: false, smartSubsample: true })
    .toFile(destination);

  await chmod(destination, 0o644);
  return await describeOutput(destination, info.width, info.height);
}

async function describeOutput(filePath: string, width: number, height: number): Promise<FileManifest> {
  const { sha256, bytes } = await hashFile(filePath);
  return { sha256, bytes, width, height };
}

export function toResult(manifest: ImageManifest, duplicate: boolean): ImageUploadResult {
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

export async function verifyPublicImages(result: ImageUploadResult, manifest: ImageManifest): Promise<void> {
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

export function isImageManifest(value: unknown): value is ImageManifest {
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
