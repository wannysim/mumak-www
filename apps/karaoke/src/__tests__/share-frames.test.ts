import qrcode from 'qrcode-generator';
import { describe, expect, it, vi } from 'vitest';

import type { StoredLyricsEntry } from '../lib/lyrics-import';
import { createKaraokeShareBundle, type KaraokeShareBundle } from '../lib/share/bundle';
import { base45Length, base45ToBytes, bytesToBase45, concatBytes, crc32 } from '../lib/share/codec';
import { createFountainObject, FOUNTAIN_OBJECT_HEADER_BYTES, MAX_FOUNTAIN_BLOCKS } from '../lib/share/fountain';
import {
  createShareFrameStream,
  DEFAULT_SHARE_PROFILE_ID,
  MAX_QR_SHARE_BYTES,
  profileBytesPerSecond,
  profileHoldFrames,
  SHARE_PROFILES,
  shareFrameChars,
  ShareFrameCollector,
  shareProfile,
  shareProfileByCode,
  type ShareFrameStream,
  type ShareProfile,
} from '../lib/share/frames';
import { createDefaultSongLibrary } from '../lib/song-library';

/** qrcode-generator는 버전을 리터럴 유니온으로 받는다. 프로파일의 number를 그 폭으로 좁힌다. */
type QrTypeNumber = Parameters<typeof qrcode>[0];

/** 헤더는 `MK3:` + CODE + ID8 + `:` + K3 + `:` + N7 + `:` = 26자로 고정이다. */
const FRAME_HEADER_CHARS = 26;

/** 블록이 여러 개 나오도록 실제 가사보다 길게 만든다. 파운틴 심볼이 systematic 구간을 넘어가야 의미가 있다. */
const sampleLyrics: StoredLyricsEntry[] = [
  {
    slug: 'kaiju-no-hanauta',
    lyrics: Array.from({ length: 600 }, (_, index) => ({
      time: index * 4.2,
      jp: `思い出すのは ${index} 君の歌 ${index * 97}`,
      pron: `오모이다스노와 ${index} 키미노 우타 ${index * 193}`,
      ko: `떠올리는 것은 ${index} 너의 노래 ${index * 389}`,
    })),
  },
  {
    slug: 'fujii-kaze-kirari',
    lyrics: [{ time: 0, jp: '荒れ狂う季節の中を', pron: '아레쿠루우 키세츠노 나카오', ko: '거친 계절 속을' }],
  },
];

function sampleBundle(): KaraokeShareBundle {
  const library = createDefaultSongLibrary();
  return createKaraokeShareBundle({
    library,
    kind: 'playlist',
    playlistId: 'vaundy',
    songSlug: library.playlists[0]!.songSlugs[0]!,
    lyrics: sampleLyrics,
  });
}

/** K = 1이 되는 최소 번들. 풀 크기의 하한(8) 분기를 덮는다. */
function tinyBundle(): KaraokeShareBundle {
  return createKaraokeShareBundle({
    library: createDefaultSongLibrary(),
    kind: 'song',
    playlistId: 'vaundy',
    songSlug: 'kaiju-no-hanauta',
  });
}

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

function shuffled(values: readonly number[], seed: number): number[] {
  const random = createTestRandom(seed);
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target]!, result[index]!];
  }
  return result;
}

function base36(value: number, width: number): string {
  return value.toString(36).toUpperCase().padStart(width, '0');
}

function uint32Bytes(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
}

type FrameFields = { code: string; id: string; blockCount: number; index: number; symbol: Uint8Array };

/** 스펙의 와이어 포맷을 구현과 독립적으로 다시 조립한다. 포맷이 바뀌면 여기서 먼저 깨진다. */
function buildFrame({ code, id, blockCount, index, symbol }: FrameFields): string {
  const checksum = crc32(concatBytes([uint32Bytes(index), symbol], 4 + symbol.byteLength));
  const payload = bytesToBase45(concatBytes([symbol, uint32Bytes(checksum)], symbol.byteLength + 4));
  return `MK3:${code}${id}:${base36(blockCount, 3)}:${base36(index, 7)}:${payload}`;
}

/** base45 알파벳에 `:`이 있어 split(':')을 쓸 수 없다. 헤더 폭이 고정이라 슬라이스로 자른다. */
function readFrame(frame: string): FrameFields {
  const bytes = base45ToBytes(frame.slice(FRAME_HEADER_CHARS));
  return {
    code: frame.slice(4, 5),
    id: frame.slice(5, 13),
    blockCount: Number.parseInt(frame.slice(14, 17), 36),
    index: Number.parseInt(frame.slice(18, 25), 36),
    symbol: bytes.slice(0, bytes.byteLength - 4),
  };
}

function poolFrames(stream: ShareFrameStream): string[] {
  return Array.from({ length: stream.poolSize }, (_, index) => stream.frameAt(index));
}

function encodeQr(frame: string, profile: ShareProfile) {
  const qr = qrcode(profile.typeNumber as QrTypeNumber, profile.level);
  qr.addData(frame, 'Alphanumeric');
  qr.make();
  return qr;
}

describe('share profiles', () => {
  it('publishes the four measured profiles with their lane counts and theoretical ceilings', () => {
    expect(SHARE_PROFILES.map(profile => [profile.id, profile.code, profile.label, profile.lanes])).toEqual([
      ['safe', 'S', '안정', 1],
      ['fast', 'F', '빠르게', 1],
      ['turbo', 'T', '고속', 1],
      ['max', 'M', '최대', 2],
    ]);
    expect(SHARE_PROFILES.map(profile => [profile.typeNumber, profile.level, profile.blockBytes])).toEqual([
      [16, 'M', 416],
      [25, 'L', 1214],
      [30, 'L', 1658],
      [40, 'L', 2842],
    ]);

    expect(SHARE_PROFILES.map(profile => profileBytesPerSecond(profile))).toEqual([4_160, 24_280, 49_740, 170_520]);
    expect(profileBytesPerSecond(shareProfile('fast')) / 1024).toBeCloseTo(23.7, 1);
    expect(profileBytesPerSecond(shareProfile('turbo')) / 1024).toBeCloseTo(48.6, 1);
    expect(profileBytesPerSecond(shareProfile('max')) / 1024).toBeCloseTo(166.5, 1);

    expect(DEFAULT_SHARE_PROFILE_ID).toBe('fast');
    for (const profile of SHARE_PROFILES) {
      expect(shareProfile(profile.id)).toBe(profile);
      expect(shareProfileByCode(profile.code)).toBe(profile);
    }
    // 수신은 프레임의 CODE 한 글자로만 레인 수를 안다. 모르는 코드는 프레임 단계에서 이미 걸러진다.
    expect(shareProfileByCode('X')).toBeNull();
    expect(shareProfileByCode('')).toBeNull();
  });

  it('derives the hold count from the measured display fps and never starves the second lane', () => {
    expect(SHARE_PROFILES.map(profile => profileHoldFrames(profile, 60))).toEqual([6, 3, 2, 2]);
    // 120Hz 기기에서 하드코딩한 holdFrames는 표시 속도를 두 배로 만든다.
    expect(SHARE_PROFILES.map(profile => profileHoldFrames(profile, 120))).toEqual([12, 6, 4, 4]);
    expect(profileHoldFrames(shareProfile('fast'), 20)).toBe(1);
    expect(profileHoldFrames(shareProfile('fast'), 0)).toBe(1);
    expect(profileHoldFrames(shareProfile('fast'), Number.NaN)).toBe(1);
    // 레인 l은 `frame % hold === l`에서 갱신된다. hold가 레인 수보다 작으면 레인 1이 영원히 멈춘다.
    expect(profileHoldFrames(shareProfile('max'), 30)).toBe(2);
    expect(profileHoldFrames(shareProfile('max'), 0)).toBe(2);
  });
});

describe('share frame wire format', () => {
  it('fits every profile frame inside its declared QR version', async () => {
    const bundle = sampleBundle();

    for (const profile of SHARE_PROFILES) {
      const stream = await createShareFrameStream(bundle, profile);
      const frame = stream.frameAt(0);

      expect(frame).toHaveLength(shareFrameChars(profile));
      expect(frame).toHaveLength(FRAME_HEADER_CHARS + base45Length(profile.blockBytes + 4));

      const qr = encodeQr(frame, profile);
      expect(qr.getModuleCount()).toBe(profile.typeNumber * 4 + 17);
      // 블록을 2바이트(=base45 3자) 늘리면 라이브러리가 던진다. 버전이 조용히 올라갈 수 없는 근거다.
      expect(() => encodeQr(`${frame}ABC`, profile)).toThrow(/code length overflow/u);
    }
  });

  it('keeps every frame in a stream the same length so the QR version never changes mid-stream', async () => {
    for (const profile of SHARE_PROFILES) {
      const stream = await createShareFrameStream(sampleBundle(), profile);
      const lengths = new Set(poolFrames(stream).map(frame => frame.length));
      expect([...lengths]).toEqual([shareFrameChars(profile)]);
    }
  });

  it('places the profile code, id, K and symbol index in fixed columns', async () => {
    const stream = await createShareFrameStream(sampleBundle(), shareProfile('safe'));
    const frame = stream.frameAt(37);

    expect(frame.startsWith('MK3:')).toBe(true);
    expect(frame[13]).toBe(':');
    expect(frame[17]).toBe(':');
    expect(frame[25]).toBe(':');
    expect(readFrame(frame)).toMatchObject({
      code: 'S',
      id: stream.id,
      blockCount: stream.blockCount,
      index: 37,
    });
    expect(stream.id).toMatch(/^[0-9A-F]{8}$/u);
    expect(readFrame(frame).symbol.byteLength).toBe(416);
    // 독립적으로 조립한 프레임이 구현과 바이트 단위로 같아야 한다.
    expect(buildFrame(readFrame(frame))).toBe(frame);
  });
});

describe('createShareFrameStream', () => {
  it('sizes the pre-encoded pool with 25 percent headroom and stays deterministic', async () => {
    const profile = shareProfile('safe');
    const stream = await createShareFrameStream(sampleBundle(), profile);

    expect(stream.profile).toBe(profile);
    expect(stream.blockCount).toBeGreaterThan(32);
    expect(stream.payloadBytes).toBeGreaterThan(profile.blockBytes);
    expect(stream.objectBytes).toBe(stream.blockCount * profile.blockBytes);
    expect(stream.poolSize).toBeGreaterThanOrEqual(stream.blockCount + Math.ceil(stream.blockCount / 4));
    expect(stream.frameAt(5)).toBe(stream.frameAt(5));

    const tiny = await createShareFrameStream(tinyBundle(), shareProfile('fast'));
    expect(tiny.blockCount).toBe(1);
    expect(tiny.poolSize).toBe(9);
  });

  it('keeps the pool size odd so a receiver that sees only one of two lanes still reaches rank K', async () => {
    const stream = await createShareFrameStream(sampleBundle(), shareProfile('max'));
    expect(stream.poolSize % 2).toBe(1);

    /**
     * 2레인은 하나의 cursor를 나눠 쓴다: 레인 0은 짝수 cursor, 레인 1은 홀수 cursor를 표시한다.
     * 한쪽 레인만 카메라에 들어온 수신은 `pool[(2n) % poolSize]`만 본다. poolSize가 짝수면 그 집합이
     * 절반에 갇혀 랭크 K에 영원히 도달하지 못하고, 홀수면 2가 mod poolSize에서 가역이라 전부 돈다.
     */
    const oneLaneWalk = (poolSize: number, laps: number) =>
      new Set(Array.from({ length: poolSize * laps }, (_, step) => (step * 2) % poolSize)).size;
    expect(oneLaneWalk(48, 4)).toBe(24);
    expect(oneLaneWalk(49, 4)).toBe(49);
    expect(oneLaneWalk(stream.poolSize, 4)).toBe(stream.poolSize);

    const collector = new ShareFrameCollector();
    let progress = collector.progress;
    for (let step = 0; !progress.complete && step < stream.poolSize * 4; step += 1) {
      progress = collector.add(stream.frameAt((step * 2) % stream.poolSize));
    }
    expect(progress).toMatchObject({ profileCode: 'M', rank: stream.blockCount, complete: true });
  });

  it('keeps K inside the fountain decoder limit at the compression boundary', async () => {
    const limit = MAX_QR_SHARE_BYTES - FOUNTAIN_OBJECT_HEADER_BYTES;
    const smallestBlock = Math.min(...SHARE_PROFILES.map(profile => profile.blockBytes));
    expect(Math.ceil(MAX_QR_SHARE_BYTES / smallestBlock)).toBeLessThanOrEqual(MAX_FOUNTAIN_BLOCKS);

    // 13바이트 헤더도 블록 0 안에 들어가므로 상한에서 빼야 한다. 384B 블록에서 정확히 경계가 드러난다.
    await expect(createFountainObject(new Uint8Array(limit), 384)).resolves.toMatchObject({
      blockCount: MAX_FOUNTAIN_BLOCKS,
    });
    await expect(createFountainObject(new Uint8Array(MAX_QR_SHARE_BYTES), 384)).rejects.toThrow(
      'QR로 보내기에는 데이터가 너무 큽니다'
    );
  });

  it('refuses to build a stream in a browser without compression support', async () => {
    vi.stubGlobal('CompressionStream', undefined);
    await expect(createShareFrameStream(sampleBundle(), shareProfile('fast'))).rejects.toThrow(
      '압축을 지원하지 않습니다'
    );
    vi.unstubAllGlobals();
  });
});

describe('ShareFrameCollector', () => {
  it('restores the bundle from a lossy walk over the pool', async () => {
    const bundle = sampleBundle();
    const stream = await createShareFrameStream(bundle, shareProfile('safe'));
    const collector = new ShareFrameCollector();
    const random = createTestRandom(0x5eed);

    // 카메라가 표시 프레임의 80%만 잡는 상황. 풀을 순서대로 순환하며 놓친 것은 다음 바퀴에 줍는다.
    let displayed = 0;
    let progress = collector.progress;
    while (!progress.complete && displayed < stream.poolSize * 4) {
      const index = displayed % stream.poolSize;
      displayed += 1;
      if (random() < 0.2) continue;
      progress = collector.add(stream.frameAt(index));
    }

    expect(progress).toMatchObject({
      id: stream.id,
      profileCode: 'S',
      rank: stream.blockCount,
      blockCount: stream.blockCount,
      objectBytes: stream.objectBytes,
      droppedSymbols: 0,
      complete: true,
    });
    // 유한 풀의 천장: 무한 스트림이면 약 K장으로 끝나지만 여기서는 한 바퀴를 조금 넘긴다.
    expect(displayed).toBeLessThanOrEqual(stream.poolSize * 2);
    expect(progress.acceptedSymbols).toBeLessThan(stream.poolSize * 2);
    expect(await collector.decode()).toEqual(bundle);
  });

  it('completes from the first K pool frames in any order', async () => {
    const bundle = sampleBundle();
    const stream = await createShareFrameStream(bundle, shareProfile('fast'));
    const collector = new ShareFrameCollector();

    const indices = shuffled(
      Array.from({ length: stream.blockCount }, (_, index) => index),
      0xbeef
    );
    expect(indices).not.toEqual([...indices].toSorted((left, right) => left - right));
    for (const index of indices) collector.add(stream.frameAt(index));

    expect(collector.progress).toMatchObject({ rank: stream.blockCount, profileCode: 'F', complete: true });
    expect(await collector.decode()).toEqual(bundle);
  });

  it('drops a CRC damaged frame without throwing', async () => {
    const stream = await createShareFrameStream(sampleBundle(), shareProfile('safe'));
    const collector = new ShareFrameCollector();
    collector.add(stream.frameAt(0));

    const frame = stream.frameAt(1);
    const payload = frame.slice(FRAME_HEADER_CHARS);
    const damaged = `${frame.slice(0, FRAME_HEADER_CHARS)}${payload[0] === '0' ? '1' : '0'}${payload.slice(1)}`;
    expect(damaged).toHaveLength(frame.length);

    // 손상 심볼 하나가 XOR 소거를 오염시키면 전송 전체를 처음부터 다시 해야 한다. 그래서 조용히 버린다.
    expect(collector.add(damaged)).toMatchObject({ rank: 1, acceptedSymbols: 1, droppedSymbols: 1 });
    expect(collector.add(frame)).toMatchObject({ rank: 2, acceptedSymbols: 2, droppedSymbols: 1 });
  });

  it('drops malformed text without throwing', () => {
    const collector = new ShareFrameCollector();
    const symbol = Uint8Array.from({ length: 8 }, (_, index) => index * 17);
    const valid = buildFrame({ code: 'S', id: '1A2B3C4D', blockCount: 2, index: 0, symbol });

    const rejected = [
      '',
      'hello',
      'MK3:',
      // 알 수 없는 프로파일 코드. 살아 있는 네 코드(S·F·T·M)만 받는다.
      valid.replace('MK3:S', 'MK3:X'),
      // 소문자 ID
      valid.replace('1A2B3C4D', '1a2b3c4d'),
      // base45 알파벳 밖의 문자
      `${valid.slice(0, FRAME_HEADER_CHARS)}#${valid.slice(FRAME_HEADER_CHARS + 1)}`,
      // base45 길이가 3의 배수 + 1
      `${valid}0`,
      // K = 0
      buildFrame({ code: 'S', id: '1A2B3C4D', blockCount: 0, index: 0, symbol }),
      // 심볼 없이 CRC만 있는 프레임
      `${valid.slice(0, FRAME_HEADER_CHARS)}${bytesToBase45(uint32Bytes(0))}`,
      // 프로파일 최대 프레임보다 긴 텍스트
      `${valid.slice(0, FRAME_HEADER_CHARS)}${'A'.repeat(6_000)}`,
    ];
    for (const text of rejected) collector.add(text);

    expect(collector.progress).toMatchObject({
      id: null,
      profileCode: null,
      rank: 0,
      acceptedSymbols: 0,
      droppedSymbols: rejected.length,
      complete: false,
    });
    // 통계는 현재 전송 기준이다. 첫 유효 프레임이 새 전송을 열면 그 전까지의 누적은 버린다.
    expect(collector.add(valid)).toMatchObject({ id: '1A2B3C4D', acceptedSymbols: 1, droppedSymbols: 0 });
  });

  it('resets when a frame from another transfer arrives', async () => {
    const library = createDefaultSongLibrary();
    const first = await createShareFrameStream(
      createKaraokeShareBundle({ library, kind: 'playlist', playlistId: 'vaundy', songSlug: 'kaiju-no-hanauta' }),
      shareProfile('safe')
    );
    const second = await createShareFrameStream(
      createKaraokeShareBundle({ library, kind: 'song', playlistId: 'vaundy', songSlug: 'odoriko' }),
      shareProfile('safe')
    );
    expect(second.id).not.toBe(first.id);

    const collector = new ShareFrameCollector();
    collector.add(first.frameAt(0));
    expect(collector.progress).toMatchObject({ id: first.id, rank: 1, acceptedSymbols: 1 });

    // 다른 전송이 화면에 뜨면 이전 랭크는 쓸 수 없다. 누적 통계까지 처음부터 다시 센다.
    expect(collector.add(second.frameAt(0))).toMatchObject({ id: second.id, rank: 1, acceptedSymbols: 1 });

    collector.reset();
    expect(collector.progress).toMatchObject({ id: null, profileCode: null, rank: 0, blockCount: 0, objectBytes: 0 });
    expect(collector.complete).toBe(false);
  });

  it('throws for MK1 and MK2 frames', () => {
    const collector = new ShareFrameCollector();
    expect(() => collector.add('MK1|abcdefghijklmnop|0|2|AQ')).toThrow('오래된 버전입니다');
    expect(() => collector.add('MK2:0123456789ABCDEF01234567:0:1:0')).toThrow('오래된 버전입니다');
    expect(collector.progress.droppedSymbols).toBe(0);
  });

  it('throws when K exceeds the decoder limit without losing the current transfer', async () => {
    const stream = await createShareFrameStream(sampleBundle(), shareProfile('safe'));
    const collector = new ShareFrameCollector();
    collector.add(stream.frameAt(0));

    const oversized = buildFrame({
      code: 'S',
      id: '1A2B3C4D',
      blockCount: MAX_FOUNTAIN_BLOCKS + 1,
      index: 0,
      symbol: new Uint8Array(8),
    });
    expect(() => collector.add(oversized)).toThrow('너무 커서 받을 수 없습니다');
    expect(collector.progress).toMatchObject({ id: stream.id, rank: 1, acceptedSymbols: 1 });
  });

  it('fails the digest check when a symbol is tampered with a matching CRC', async () => {
    const stream = await createShareFrameStream(sampleBundle(), shareProfile('safe'));
    const collector = new ShareFrameCollector();

    for (let index = 0; index < stream.blockCount; index += 1) {
      const fields = readFrame(stream.frameAt(index));
      if (index === 3) fields.symbol[7] = fields.symbol[7]! ^ 0b1000_0000;
      collector.add(buildFrame(fields));
    }

    // CRC를 다시 맞춘 손상 심볼은 프레임 검사를 통과한다. 오브젝트 digest가 마지막 방어선이다.
    expect(collector.progress).toMatchObject({ droppedSymbols: 0, complete: true });
    await expect(collector.decode()).rejects.toThrow('무결성 검사를 통과하지 못했습니다');
  });

  it('rejects decode before the object is complete', async () => {
    const stream = await createShareFrameStream(sampleBundle(), shareProfile('safe'));
    const collector = new ShareFrameCollector();

    await expect(collector.decode()).rejects.toThrow('아직 받지 못한 QR 조각이 있습니다');
    collector.add(stream.frameAt(0));
    await expect(collector.decode()).rejects.toThrow('아직 받지 못한 QR 조각이 있습니다');
  });

  it('reports missing decompression support on decode', async () => {
    const stream = await createShareFrameStream(sampleBundle(), shareProfile('safe'));
    const collector = new ShareFrameCollector();
    for (let index = 0; index < stream.blockCount; index += 1) collector.add(stream.frameAt(index));

    vi.stubGlobal('DecompressionStream', undefined);
    await expect(collector.decode()).rejects.toThrow('압축을 지원하지 않습니다');
    vi.unstubAllGlobals();
  });
});
