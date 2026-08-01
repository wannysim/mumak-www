import qrcode from 'qrcode-generator';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createKaraokeShareBundle, type KaraokeShareBundle } from '../lib/share/bundle';
import { createShareFrameStream, SHARE_PROFILES, shareFrameChars } from '../lib/share/frames';
import { isQrModuleDark } from '../lib/share/qr-blit';
import {
  encodeQrBatch,
  encodeQrMatrix,
  type QrEncodeRequest,
  type QrEncodeResponse,
  type QrMatrix,
} from '../lib/share/qr-matrix';
import { createDefaultSongLibrary } from '../lib/song-library';

/** 프레임 길이는 blockBytes로 고정이라 번들 크기와 무관하다. 용량 검증에는 가장 작은 번들이면 된다. */
function sampleBundle(): KaraokeShareBundle {
  return createKaraokeShareBundle({
    library: createDefaultSongLibrary(),
    kind: 'song',
    playlistId: 'vaundy',
    songSlug: 'kaiju-no-hanauta',
  });
}

function asciiArt(matrix: QrMatrix): string {
  return Array.from({ length: matrix.moduleCount }, (_, row) =>
    Array.from({ length: matrix.moduleCount }, (_, column) => (isQrModuleDark(matrix, row, column) ? '#' : '.')).join(
      ''
    )
  ).join('\n');
}

describe('encodeQrMatrix', () => {
  it('packs one bit per module in row major order', () => {
    const matrix = encodeQrMatrix('HELLO WORLD', 2, 'M');
    expect(matrix.moduleCount).toBe(25);
    expect(matrix.bits.byteLength).toBe(Math.ceil((25 * 25) / 8));

    // 오라클은 라이브러리의 isDark(row, column)다. 행/열을 뒤집어 패킹하면 여기서 깨진다.
    const reference = qrcode(2, 'M');
    reference.addData('HELLO WORLD', 'Alphanumeric');
    reference.make();
    for (let row = 0; row < matrix.moduleCount; row += 1) {
      for (let column = 0; column < matrix.moduleCount; column += 1) {
        expect(isQrModuleDark(matrix, row, column)).toBe(reference.isDark(row, column));
      }
    }
  });

  it('renders a stable module snapshot for a known string', () => {
    expect(asciiArt(encodeQrMatrix('HELLO WORLD', 2, 'M'))).toMatchInlineSnapshot(`
      "#######.##..#..##.#######
      #.....#.#.##..##..#.....#
      #.###.#....#.###..#.###.#
      #.###.#.###.#...#.#.###.#
      #.###.#..#..##....#.###.#
      #.....#..#.#..#...#.....#
      #######.#.#.#.#.#.#######
      ........###.###..........
      #.##.###...#.##.#.#..#.##
      #####..#..##...##.###.#.#
      .....##...#...##.#...#.##
      #####..#.#######.#..#.###
      #.....#.........#.#....##
      ..##...##.##.#......##..#
      .#..#.##.##.#.#..###.#..#
      #.##....#.#.##.#...#.#..#
      ..#..##.#..#....#####.##.
      ........##..##..#...##.##
      #######.#..##..##.#.#....
      #.....#.#...#..##...###..
      #.###.#..#####.######.##.
      #.###.#.##..######.##...#
      #.###.#.#..###.###..#..#.
      #.....#..##....##..#.#..#
      #######.#...#.##.###....#"
    `);
  });

  it('rejects characters outside the alphanumeric charset instead of falling back to byte mode', () => {
    // Byte 모드로 조용히 떨어지면 같은 버전 용량이 절반 이하가 되어 프로파일 blockBytes가 안 들어간다.
    expect(() => encodeQrMatrix('hello world', 2, 'M')).toThrow(/illegal char/u);
  });

  it('fits every profile frame inside its declared version and never grows it silently', async () => {
    const bundle = sampleBundle();

    for (const profile of SHARE_PROFILES) {
      const stream = await createShareFrameStream(bundle, profile);
      const frame = stream.frameAt(0);
      expect(frame).toHaveLength(shareFrameChars(profile));

      const matrix = encodeQrMatrix(frame, profile.typeNumber, profile.level);
      expect(matrix.moduleCount).toBe(profile.typeNumber * 4 + 17);
      expect(matrix.bits.byteLength).toBe(Math.ceil((matrix.moduleCount * matrix.moduleCount) / 8));

      // 버전을 명시하므로 프레임이 3자만 길어져도 라이브러리가 던진다(=버전이 조용히 못 올라간다).
      expect(() => encodeQrMatrix(`${frame}ABC`, profile.typeNumber, profile.level)).toThrow(/code length overflow/u);
    }
  });
});

describe('encodeQrBatch', () => {
  it('returns one owned bit buffer per frame so the worker can transfer them', () => {
    const frames = ['MK3 A', 'MK3 B', 'MK3 C'];
    const response = encodeQrBatch({ frames, startIndex: 40, typeNumber: 2, level: 'M' });

    expect(response.startIndex).toBe(40);
    expect(response.moduleCount).toBe(25);
    expect(response.bits).toHaveLength(3);
    expect(new Set(response.bits.map(bits => bits.buffer)).size).toBe(3);
    for (const [index, bits] of response.bits.entries()) {
      expect(bits.byteLength).toBe(Math.ceil((25 * 25) / 8));
      expect([...bits]).toEqual([...encodeQrMatrix(frames[index]!, 2, 'M').bits]);
    }
  });
});

describe('qr-encoder.worker', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('answers a message with the batch and hands the bit buffers over by transfer', async () => {
    // 워커 전역을 대역으로 바꾸고 모듈을 불러 배관만 확인한다. 로직은 encodeQrBatch 쪽 테스트가 덮는다.
    let handle: ((event: { data: QrEncodeRequest }) => void) | null = null;
    const posted: { message: QrEncodeResponse; transfer: ArrayBufferLike[] }[] = [];
    vi.stubGlobal('self', {
      addEventListener: (_type: string, listener: (event: { data: QrEncodeRequest }) => void) => {
        handle = listener;
      },
      postMessage: (message: QrEncodeResponse, transfer: ArrayBufferLike[]) => posted.push({ message, transfer }),
    });

    await import('../lib/share/qr-encoder.worker');
    handle!({ data: { frames: ['MK3 A', 'MK3 B'], startIndex: 7, typeNumber: 2, level: 'M' } });

    const [call] = posted;
    expect(call?.message.startIndex).toBe(7);
    expect(call?.message.bits).toHaveLength(2);
    // transfer 목록이 비면 680 KB짜리 풀이 프레임마다 복사된다. 버퍼 동일성으로 고정한다.
    expect(call?.transfer).toEqual(call?.message.bits.map(bits => bits.buffer));
  });
});
