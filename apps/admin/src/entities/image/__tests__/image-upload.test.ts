/** @jest-environment node */
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

import { ImageUploadError, isImageManifest, toResult, verifyPublicImages, withPreparedImage } from '../image-upload';

const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
let input: Buffer;
beforeAll(async () => {
  input = await sharp({ create: { width: 20, height: 10, channels: 3, background: '#123456' } })
    .withExif({ IFD0: { Copyright: 'must-not-survive' }, IFD3: { GPSLatitude: '37/1' } })
    .jpeg()
    .toBuffer();
});
afterEach(() => jest.restoreAllMocks());

describe('temporary image preparation', () => {
  it('preserves source-v1 identity for the pinned EXIF-oriented fixture', async () => {
    const fixture = await fs.readFile(path.join(__dirname, 'fixtures/landscape-orientation-6.jpg'));
    expect(hash(fixture)).toBe('a05082c57819232106a0612f57268efab011f7a2a477483b878a2b4509cd8e59');
    await withPreparedImage(fixture, async ({ manifest, files }) => {
      expect(toResult(manifest, false)).toMatchObject({
        assetId: 'e4c54beb780223fa8bf1ced9d83712225ef07108efdf884fddca38c58975e287',
        width: 600,
        height: 450,
        bytes: { source: 176242 },
      });
      expect(hash(await fs.readFile(files.source))).toBe(manifest.assetId);
    });
  });

  it('strips metadata and removes all temporary files after the consumer finishes', async () => {
    let directory = '';
    const result = await withPreparedImage(input, async ({ manifest, files }) => {
      directory = path.dirname(files.source);
      expect(isImageManifest(manifest)).toBe(true);
      for (const file of Object.values(files)) {
        const metadata = await sharp(file).metadata();
        expect(metadata).toMatchObject({ width: 20, height: 10, space: 'srgb' });
        for (const key of ['exif', 'icc', 'xmp', 'orientation']) expect(metadata).not.toHaveProperty(key);
      }
      expect((await fs.stat(directory)).mode & 0o777).toBe(0o700);
      return toResult(manifest, false);
    });
    expect(result.urls.jpeg).toBe(`https://img.wannysim.com/blog/${result.assetId}/content-v1/image.jpg`);
    await expect(fs.stat(directory)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('keeps the existing production fixture identity and rendition checksums', async () => {
    const fixture = await sharp({
      create: { width: 192, height: 108, channels: 3, background: { r: 120, g: 70, b: 30 } },
    })
      .jpeg()
      .toBuffer();
    await withPreparedImage(fixture, async ({ manifest }) => {
      expect(toResult(manifest, false).checksums).toEqual({
        source: 'b70816b4de73f11cfcbbac852c6c5dbfc1fb2d02f981abbd8fc918748288bc6c',
        jpeg: 'e2a4fed15314cab9105a48e74ae30d9d1ef73ecc178133603b4239ac7b4e7796',
        webp: '4045774c092256e2ecd757a15695077a54a32c105d04bd1b444f7ba7d5c1b9dd',
      });
    });
  });

  it('resizes renditions inside 1600 pixels without enlarging the canonical source', async () => {
    const large = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#123456' } })
      .jpeg()
      .toBuffer();
    await withPreparedImage(large, async ({ manifest }) => {
      expect(manifest.source).toMatchObject({ width: 2000, height: 1000 });
      expect(toResult(manifest, false)).toMatchObject({ width: 1600, height: 800 });
    });
  });

  it('removes temporary files and releases admission after publication fails', async () => {
    let directory = '';
    const failure = new Error('R2 unavailable');
    await expect(
      withPreparedImage(input, async ({ files }) => {
        directory = path.dirname(files.source);
        throw failure;
      })
    ).rejects.toBe(failure);
    await expect(fs.stat(directory)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(withPreparedImage(input, async () => 'ready')).resolves.toBe('ready');
  });

  it('rejects overlapping conversion without creating another working directory', async () => {
    await withPreparedImage(input, async () => {
      await expect(withPreparedImage(input, async () => undefined)).rejects.toMatchObject({ code: 'upload_busy' });
    });
  });

  it.each([
    [Buffer.alloc(0), 'invalid_image'],
    [Buffer.from('not jpeg'), 'unsupported_media_type'],
    [Buffer.from([0xff, 0xd8, 0xff, 0x00]), 'invalid_image'],
  ])('rejects invalid input before invoking the consumer', async (bytes, code) => {
    const consume = jest.fn();
    await expect(withPreparedImage(bytes, consume)).rejects.toMatchObject({ code });
    expect(consume).not.toHaveBeenCalled();
  });
  it.each(['png', 'webp', 'avif', 'gif'] as const)(
    'converts static %s into metadata-free JPEG and WebP',
    async format => {
      const bytes = await sharp({
        create: { width: 20, height: 10, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0 } },
      })
        .toFormat(format)
        .toBuffer();
      await withPreparedImage(bytes, async ({ manifest, files }) => {
        expect(manifest.source).toMatchObject({ width: 20, height: 10 });
        expect(await sharp(files.source).metadata()).toMatchObject({ format: 'jpeg', hasAlpha: false });
        expect(await sharp(files.webp).metadata()).toMatchObject({ format: 'webp', width: 20, height: 10 });
        const pixel = await sharp(files.source).raw().toBuffer();
        expect([...pixel.subarray(0, 3)]).toEqual([255, 255, 255]);
        expect(await sharp(files.source).metadata()).not.toHaveProperty('exif');
      });
      await expect(withPreparedImage(bytes, async () => true, { maxPixels: 199 })).rejects.toMatchObject({
        code: 'pixel_limit_exceeded',
      });
    }
  );

  it.each(['gif', 'webp'] as const)('rejects animated %s without publishing a first-frame-only image', async format => {
    const pixels = Buffer.concat([Buffer.alloc(20 * 10 * 3, 0), Buffer.alloc(20 * 10 * 3, 255)]);
    const bytes = await sharp(pixels, { raw: { width: 20, height: 20, channels: 3, pageHeight: 10 } })
      .toFormat(format)
      .toBuffer();
    expect((await sharp(bytes).metadata()).pages).toBe(2);
    const consume = jest.fn();
    await expect(withPreparedImage(bytes, consume)).rejects.toMatchObject({ code: 'animated_image' });
    expect(consume).not.toHaveBeenCalled();
  });

  it('rejects APNG animation control chunks and unsupported SVG/TIFF inputs', async () => {
    const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const animationChunk = Buffer.concat([Buffer.alloc(4), Buffer.from('acTL'), Buffer.alloc(4)]);
    await expect(withPreparedImage(Buffer.concat([pngHeader, animationChunk]), jest.fn())).rejects.toMatchObject({
      code: 'animated_image',
    });
    const tiff = await sharp(input).tiff().toBuffer();
    for (const bytes of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"/>'), tiff]) {
      await expect(withPreparedImage(bytes, jest.fn())).rejects.toMatchObject({ code: 'unsupported_media_type' });
    }
  });

  it('enforces exact byte and decoded-pixel limits', async () => {
    await expect(withPreparedImage(input, async () => true, { maxBytes: input.length, maxPixels: 200 })).resolves.toBe(
      true
    );
    await expect(withPreparedImage(input, async () => true, { maxBytes: input.length - 1 })).rejects.toMatchObject({
      code: 'payload_too_large',
    });
    await expect(withPreparedImage(input, async () => true, { maxPixels: 199 })).rejects.toMatchObject({
      code: 'pixel_limit_exceeded',
    });
  });
  it.each([{ maxBytes: 0 }, { maxPixels: NaN }, { maxBytes: 1.5 }])('rejects invalid limits %j', async limits => {
    await expect(withPreparedImage(input, async () => true, limits)).rejects.toMatchObject({
      code: 'invalid_configuration',
    });
  });
  it.each(['ENOSPC', 'EDQUOT', 'EIO'])('classifies temporary storage failure %s', async code => {
    jest.spyOn(fs, 'writeFile').mockRejectedValueOnce(Object.assign(new Error(code), { code }));
    await expect(withPreparedImage(input, async () => true)).rejects.toMatchObject({
      code: code === 'EIO' ? 'storage_failure' : 'insufficient_storage',
    });
  });
  it('rejects insufficient temporary disk space before writing input', async () => {
    jest
      .spyOn(fs, 'statfs')
      .mockResolvedValueOnce({ bavail: 0n, bsize: 4096n } as Awaited<ReturnType<typeof fs.statfs>>);
    await expect(withPreparedImage(input, async () => true)).rejects.toMatchObject({ code: 'insufficient_storage' });
  });
});

describe('public rendition verification', () => {
  it('checks both renditions against their manifest before returning', async () => {
    await withPreparedImage(input, async ({ manifest, files }) => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async url => {
        const webp = String(url).endsWith('.webp');
        return new Response(new Uint8Array(await fs.readFile(webp ? files.webp : files.jpeg)), {
          headers: { 'Content-Type': webp ? 'image/webp' : 'image/jpeg' },
        });
      });
      await verifyPublicImages(toResult(manifest, false), manifest);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      for (const [, options] of fetchSpy.mock.calls)
        expect(options).toMatchObject({ redirect: 'error', cache: 'no-store' });
    });
  });
  it('rejects wrong status, MIME, missing body, length, checksum and transport failures', async () => {
    await withPreparedImage(input, async ({ manifest, files }) => {
      const bytes = new Uint8Array(await fs.readFile(files.jpeg));
      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async () => {
        const attempt = fetchSpy.mock.calls.length;
        const headers = { 'Content-Type': 'image/jpeg' };
        if (attempt === 1) return new Response(bytes, { headers: { 'Content-Type': 'text/plain' } });
        if (attempt === 2) return new Response(bytes.subarray(0, -1), { headers });
        if (attempt === 3) {
          const changed = bytes.slice();
          changed[0] = 0;
          return new Response(changed, { headers });
        }
        if (attempt === 4) return new Response(null, { headers });
        if (attempt === 5) return new Response(null, { status: 302 });
        if (attempt === 6) throw new Error('network');
        return new Response(new Uint8Array(bytes.length + 1), { headers });
      });
      await expect(verifyPublicImages(toResult(manifest, false), manifest)).rejects.toBeInstanceOf(ImageUploadError);
      expect(fetchSpy).toHaveBeenCalledTimes(10);
    });
  }, 15000);
});
