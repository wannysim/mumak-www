import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  base45Length,
  base45ToBytes,
  bytesToBase45,
  compressBytes,
  concatBytes,
  crc32,
  decompressText,
  ownedArrayBuffer,
} from '../lib/share/codec';

const TOO_LARGE = '너무 큽니다.';
const UNSUPPORTED = '이 브라우저는 QR 공유 압축을 지원하지 않습니다. 공유 파일을 이용해 주세요.';

function allByteValues(length: number): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => index % 256);
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Response(ownedArrayBuffer(bytes)).body!.pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('base45', () => {
  it('round trips even and odd byte lengths including zero bytes', () => {
    for (const source of [
      Uint8Array.from([0, 0]),
      Uint8Array.from([0]),
      Uint8Array.from([0, 0, 0]),
      Uint8Array.from([255, 0, 128, 0, 1]),
      allByteValues(256),
      allByteValues(257),
    ]) {
      expect(base45ToBytes(bytesToBase45(source))).toEqual(source);
    }
  });

  it('encodes to the length base45Length predicts', () => {
    for (const byteLength of [1, 2, 3, 4, 5, 388, 772, 1204]) {
      expect(bytesToBase45(allByteValues(byteLength))).toHaveLength(base45Length(byteLength));
    }
  });

  it('rejects characters outside the RFC 9285 alphabet', () => {
    expect(() => base45ToBytes('abc')).toThrow('QR 조각의 문자 형식이 올바르지 않습니다.');
    expect(() => base45ToBytes('00!')).toThrow('QR 조각의 문자 형식이 올바르지 않습니다.');
  });

  it('rejects an empty string and a length that leaves one dangling character', () => {
    expect(() => base45ToBytes('')).toThrow('QR 조각의 문자 형식이 올바르지 않습니다.');
    expect(() => base45ToBytes('0000')).toThrow('QR 조각의 문자 형식이 올바르지 않습니다.');
  });

  it('rejects groups that decode above the byte range', () => {
    expect(() => base45ToBytes('ZZZ')).toThrow('QR 조각을 읽을 수 없습니다.');
    expect(() => base45ToBytes(':Z')).toThrow('QR 조각을 읽을 수 없습니다.');
  });
});

describe('crc32', () => {
  it('matches the IEEE check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array(0))).toBe(0);
    expect(crc32(Uint8Array.from([0]))).toBe(0xd202ef8d);
  });

  it('changes when a single bit flips', () => {
    const source = allByteValues(64);
    const flipped = Uint8Array.from(source);
    flipped[31] = source[31]! ^ 0x01;
    expect(crc32(flipped)).not.toBe(crc32(source));
  });
});

describe('byte utilities', () => {
  it('concatenates chunks into a buffer of the given total length', () => {
    const joined = concatBytes([Uint8Array.from([1, 2]), Uint8Array.from([3])], 3);
    expect(Array.from(joined)).toEqual([1, 2, 3]);
  });

  it('copies views into a standalone ArrayBuffer', () => {
    const source = allByteValues(8);
    const view = source.subarray(2, 5);
    const buffer = ownedArrayBuffer(view);
    expect(buffer.byteLength).toBe(3);
    expect(Array.from(new Uint8Array(buffer))).toEqual([2, 3, 4]);
  });
});

describe('deflate-raw compression', () => {
  const text = `${'가'.repeat(2_000)}{"format":"mumak-karaoke-share"}`;

  it('round trips multi byte text', async () => {
    const compressed = await compressBytes(text, 1 << 20, TOO_LARGE);
    expect(compressed.byteLength).toBeLessThan(new TextEncoder().encode(text).byteLength);
    await expect(decompressText(compressed, 1 << 20, TOO_LARGE)).resolves.toBe(text);
  });

  it('enforces the limit while compressing', async () => {
    await expect(compressBytes(text, 8, TOO_LARGE)).rejects.toThrow(TOO_LARGE);
  });

  it('enforces the limit while decompressing', async () => {
    const compressed = await compressBytes(text, 1 << 20, TOO_LARGE);
    await expect(decompressText(compressed, 8, TOO_LARGE)).rejects.toThrow(TOO_LARGE);
  });

  it('rejects payloads that are not valid utf-8', async () => {
    const compressed = await deflateRaw(Uint8Array.from([0xff, 0xfe, 0xfd]));
    await expect(decompressText(compressed, 1 << 20, TOO_LARGE)).rejects.toThrow(
      '공유 데이터의 문자 형식이 올바르지 않습니다.'
    );
  });

  it('explains that the browser cannot compress', async () => {
    vi.stubGlobal('CompressionStream', undefined);
    await expect(compressBytes('가사', 1 << 20, TOO_LARGE)).rejects.toThrow(UNSUPPORTED);
  });

  it('explains that the browser cannot decompress', async () => {
    vi.stubGlobal('DecompressionStream', undefined);
    await expect(decompressText(Uint8Array.from([1]), 1 << 20, TOO_LARGE)).rejects.toThrow(UNSUPPORTED);
  });
});
