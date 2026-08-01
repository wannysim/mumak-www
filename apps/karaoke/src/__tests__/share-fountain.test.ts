import { describe, expect, it } from 'vitest';

import {
  createFountainObject,
  encodeSymbol,
  FOUNTAIN_OBJECT_HEADER_BYTES,
  FountainDecoder,
  MAX_FOUNTAIN_BLOCKS,
  readFountainObject,
  symbolMask,
} from '../lib/share/fountain';

/** 실패를 재현할 수 있도록 테스트 난수는 시드 고정 xorshift32를 쓴다. */
function createTestRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4_294_967_296;
  };
}

function samplePayload(length: number, seed = 0xc0f_fee): Uint8Array {
  const random = createTestRandom(seed);
  return Uint8Array.from({ length }, () => Math.floor(random() * 256));
}

function shuffled(values: readonly number[], seed: number): number[] {
  const random = createTestRandom(seed);
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target]!, result[index]!];
  }
  return result;
}

/**
 * 스펙 문서의 mulberry32를 테스트에서 독립적으로 다시 구현한다.
 * 구현이 조용히 바뀌면 여기서 먼저 깨진다(양쪽 기기가 같은 마스크를 얻어야 하는 계약).
 */
function expectedMaskDraws(index: number, blockCount: number): number[] {
  let state = Math.imul(index + 1, 0x9e37_79b1) >>> 0;
  const next = () => {
    state = (state + 0x6d2b_79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  return Array.from({ length: blockCount }, () => next());
}

function expectedMask(index: number, blockCount: number): number[] {
  const words = Array.from<number>({ length: Math.ceil(blockCount / 32) }).fill(0);
  const setBit = (bit: number) => {
    words[bit >>> 5] = words[bit >>> 5]! | (1 << (bit & 31));
  };
  if (index < blockCount) {
    setBit(index);
  } else {
    const draws = expectedMaskDraws(index, blockCount);
    draws.forEach((draw, block) => {
      if (draw < 0.5) setBit(block);
    });
    if (draws.every(draw => draw >= 0.5)) setBit(0);
  }
  return words.map(word => word >>> 0);
}

function popCount(mask: Uint32Array): number {
  let total = 0;
  for (const word of mask) {
    for (let bit = 0; bit < 32; bit += 1) {
      if ((word & (1 << bit)) !== 0) total += 1;
    }
  }
  return total;
}

const BLOCK_BYTES = 24;
const PAYLOAD_BYTES = 500;
/** ceil((13 + 500) / 24) */
const BLOCK_COUNT = 22;

async function sampleObject() {
  const payload = samplePayload(PAYLOAD_BYTES);
  return { payload, object: await createFountainObject(payload, BLOCK_BYTES) };
}

describe('createFountainObject', () => {
  it('writes the 13 byte header and pads to blockCount * blockBytes', async () => {
    const { payload, object } = await sampleObject();

    expect(object.blockCount).toBe(BLOCK_COUNT);
    expect(object.blockBytes).toBe(BLOCK_BYTES);
    expect(object.payloadBytes).toBe(PAYLOAD_BYTES);
    expect(object.data.byteLength).toBe(BLOCK_COUNT * BLOCK_BYTES);
    expect(object.id).toMatch(/^[0-9A-F]{8}$/u);

    expect(object.data[0]).toBe(0x03);
    const header = new DataView(object.data.buffer, object.data.byteOffset, FOUNTAIN_OBJECT_HEADER_BYTES);
    expect(header.getUint32(1, false)).toBe(PAYLOAD_BYTES);

    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(payload).buffer));
    expect([...object.data.subarray(5, 13)]).toEqual([...digest.subarray(0, 8)]);
    expect(object.id).toBe(
      Array.from(digest.subarray(0, 4), byte => byte.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()
    );

    expect([
      ...object.data.subarray(FOUNTAIN_OBJECT_HEADER_BYTES, FOUNTAIN_OBJECT_HEADER_BYTES + PAYLOAD_BYTES),
    ]).toEqual([...payload]);
    expect([...object.data.subarray(FOUNTAIN_OBJECT_HEADER_BYTES + PAYLOAD_BYTES)].every(byte => byte === 0)).toBe(
      true
    );
  });

  it('round-trips the payload through readFountainObject', async () => {
    const { payload, object } = await sampleObject();
    expect([...(await readFountainObject(object.data))]).toEqual([...payload]);
  });

  it('rejects an object whose blockCount exceeds MAX_FOUNTAIN_BLOCKS', async () => {
    await expect(createFountainObject(samplePayload(MAX_FOUNTAIN_BLOCKS + 1), 1)).rejects.toThrow(
      'QR로 보내기에는 데이터가 너무 큽니다'
    );
    await expect(createFountainObject(samplePayload(64), 0)).rejects.toThrow('블록 구성이 올바르지 않습니다');
  });

  it('still produces one block for a payload that fits in the first block', async () => {
    const payload = samplePayload(20);
    const object = await createFountainObject(payload, 64);

    expect(object.blockCount).toBe(1);
    expect(object.data.byteLength).toBe(64);
    expect([...(await readFountainObject(object.data))]).toEqual([...payload]);
  });
});

describe('readFountainObject', () => {
  it('rejects a truncated header, an unknown version and an impossible payload length', async () => {
    await expect(readFountainObject(new Uint8Array(FOUNTAIN_OBJECT_HEADER_BYTES - 1))).rejects.toThrow(
      '형식이 올바르지 않습니다'
    );

    const { object } = await sampleObject();

    const wrongVersion = object.data.slice();
    wrongVersion[0] = 0x02;
    await expect(readFountainObject(wrongVersion)).rejects.toThrow('형식이 올바르지 않습니다');

    const impossibleLength = object.data.slice();
    new DataView(impossibleLength.buffer).setUint32(1, object.data.byteLength, false);
    await expect(readFountainObject(impossibleLength)).rejects.toThrow('형식이 올바르지 않습니다');
  });
});

describe('symbolMask', () => {
  it('uses a systematic prefix for index < blockCount', () => {
    for (const index of [0, 1, 7, 21]) {
      const mask = symbolMask(index, BLOCK_COUNT);
      expect(popCount(mask)).toBe(1);
      expect((mask[index >>> 5]! & (1 << (index & 31))) !== 0).toBe(true);
    }

    const highBit = symbolMask(39, 40);
    expect([...highBit]).toEqual([0, 128]);
  });

  // 이 값들은 두 기기가 공유하는 와이어 계약이다. 바뀌면 구버전과 서로 복원할 수 없다.
  it('pins the PRNG masks for fixed seeds', () => {
    expect([...symbolMask(40, 40)]).toEqual([772_231_278, 33]);
    expect([...symbolMask(41, 40)]).toEqual([3_068_776_899, 246]);
    expect([...symbolMask(1000, 40)]).toEqual([1_581_764_558, 193]);
    expect([...symbolMask(64, 64)]).toEqual([3_736_157_511, 200_289_324]);
    expect([...symbolMask(65, 64)]).toEqual([930_823_564, 1_221_100_296]);
  });

  it('matches an independent implementation of the spec PRNG', () => {
    for (const blockCount of [1, 2, 22, 32, 33, 64, 100]) {
      for (let index = 0; index < blockCount + 40; index += 1) {
        expect([...symbolMask(index, blockCount)]).toEqual(expectedMask(index, blockCount));
      }
    }
  });

  it('falls back to block 0 when every draw misses', () => {
    // blockCount 2, index 3의 두 draw는 모두 0.5 이상이라 마스크가 비어버리는 경우다.
    expect(expectedMaskDraws(3, 2).every(draw => draw >= 0.5)).toBe(true);
    expect([...symbolMask(3, 2)]).toEqual([1]);
  });

  it('never returns an empty mask', () => {
    for (let index = 0; index < 400; index += 1) {
      expect(popCount(symbolMask(index, 37))).toBeGreaterThan(0);
    }
  });
});

describe('encodeSymbol', () => {
  it('returns the block itself for a systematic index', async () => {
    const { object } = await sampleObject();

    for (let block = 0; block < object.blockCount; block += 1) {
      expect([...encodeSymbol(object, block)]).toEqual([
        ...object.data.subarray(block * BLOCK_BYTES, (block + 1) * BLOCK_BYTES),
      ]);
    }
  });

  it('returns the XOR of the masked blocks for a random index', async () => {
    const { object } = await sampleObject();
    const index = 137;
    const mask = symbolMask(index, object.blockCount);

    const expected = new Uint8Array(BLOCK_BYTES);
    for (let block = 0; block < object.blockCount; block += 1) {
      if ((mask[block >>> 5]! & (1 << (block & 31))) === 0) continue;
      for (let offset = 0; offset < BLOCK_BYTES; offset += 1) {
        expected[offset] = expected[offset]! ^ object.data[block * BLOCK_BYTES + offset]!;
      }
    }

    expect([...encodeSymbol(object, index)]).toEqual([...expected]);
    expect(popCount(mask)).toBeGreaterThan(1);
  });
});

describe('FountainDecoder', () => {
  it('recovers from a random 60% subset of 3K symbols', async () => {
    const { payload, object } = await sampleObject();
    const indices = shuffled(
      Array.from({ length: object.blockCount * 3 }, (_, index) => index),
      0x5eed
    );
    const subset = indices.slice(0, Math.round(indices.length * 0.6));
    expect(subset.length).toBe(40);

    const decoder = new FountainDecoder(object.blockCount, object.blockBytes);
    for (const index of subset) decoder.add(index, encodeSymbol(object, index));

    expect(decoder.rank).toBe(object.blockCount);
    expect(decoder.complete).toBe(true);
    expect([...(await readFountainObject(decoder.recover()))]).toEqual([...payload]);
  });

  it('recovers when every systematic symbol is discarded', async () => {
    const { payload, object } = await sampleObject();
    const decoder = new FountainDecoder(object.blockCount, object.blockBytes);

    let used = 0;
    for (let index = object.blockCount; index < object.blockCount * 4 && !decoder.complete; index += 1) {
      decoder.add(index, encodeSymbol(object, index));
      used += 1;
    }

    expect(decoder.complete).toBe(true);
    // 기대 오버헤드는 심볼 약 1.6개. 여유를 둬도 K + 16을 넘으면 마스크 분포가 망가진 것이다.
    expect(used).toBeLessThanOrEqual(object.blockCount + 16);
    expect([...(await readFountainObject(decoder.recover()))]).toEqual([...payload]);
  });

  it('does not raise rank for a linearly dependent symbol', async () => {
    const { object } = await sampleObject();
    const decoder = new FountainDecoder(object.blockCount, object.blockBytes);

    expect(decoder.add(30, encodeSymbol(object, 30))).toBe(true);
    expect(decoder.rank).toBe(1);
    expect(decoder.add(30, encodeSymbol(object, 30))).toBe(false);
    expect(decoder.rank).toBe(1);

    for (let index = 0; index < object.blockCount; index += 1) decoder.add(index, encodeSymbol(object, index));
    expect(decoder.complete).toBe(true);

    // 랭크가 K에 도달한 뒤에는 어떤 심볼도 새 정보를 주지 못한다.
    expect(decoder.add(999, encodeSymbol(object, 999))).toBe(false);
    expect(decoder.rank).toBe(object.blockCount);
  });

  it('keeps every pivot row normalised so its lowest set bit is its own index', async () => {
    const { object } = await sampleObject();
    const decoder = new FountainDecoder(object.blockCount, object.blockBytes);
    for (let index = object.blockCount; !decoder.complete; index += 1) {
      decoder.add(index, encodeSymbol(object, index));
    }

    // 소거 불변식이 깨지면 후방 대입이 조용히 틀린 블록을 낸다.
    // 복원 결과가 원본 오브젝트와 바이트 단위로 같은지로 확인한다.
    expect([...decoder.recover()]).toEqual([...object.data]);
  });

  it('fails the digest check when a single symbol is corrupted', async () => {
    const { object } = await sampleObject();
    const decoder = new FountainDecoder(object.blockCount, object.blockBytes);

    for (let index = 0; index < object.blockCount; index += 1) {
      const symbol = encodeSymbol(object, index);
      if (index === 5) symbol[7] = symbol[7]! ^ 0b1000_0000;
      decoder.add(index, symbol);
    }

    expect(decoder.complete).toBe(true);
    await expect(readFountainObject(decoder.recover())).rejects.toThrow('무결성 검사를 통과하지 못했습니다');
  });

  it('recovers a K=1 object from a non-systematic symbol', async () => {
    const payload = samplePayload(20);
    const object = await createFountainObject(payload, 64);
    const decoder = new FountainDecoder(object.blockCount, object.blockBytes);

    expect(decoder.complete).toBe(false);
    expect(decoder.add(9, encodeSymbol(object, 9))).toBe(true);
    expect(decoder.complete).toBe(true);
    expect([...decoder.recover()]).toEqual([...object.data]);
    expect([...(await readFountainObject(decoder.recover()))]).toEqual([...payload]);
  });

  it('rejects an out-of-range block layout, a wrong symbol length and an early recover', () => {
    expect(() => new FountainDecoder(MAX_FOUNTAIN_BLOCKS + 1, 24)).toThrow('너무 커서 받을 수 없습니다');
    expect(() => new FountainDecoder(0, 24)).toThrow('블록 구성이 올바르지 않습니다');
    expect(() => new FountainDecoder(4, 0)).toThrow('블록 구성이 올바르지 않습니다');

    const decoder = new FountainDecoder(4, 24);
    expect(() => decoder.add(0, new Uint8Array(23))).toThrow('데이터 길이가 올바르지 않습니다');
    expect(() => decoder.recover()).toThrow('아직 받지 못한 QR 조각이 있습니다');
  });
});
