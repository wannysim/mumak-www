import {
  MAX_SHARE_FILE_BYTES,
  parseKaraokeShareText,
  serializeKaraokeShareBundle,
  type KaraokeShareBundle,
} from '@/lib/share/bundle';
import {
  base45Length,
  base45ToBytes,
  bytesToBase45,
  compressBytes,
  concatBytes,
  crc32,
  decompressText,
} from '@/lib/share/codec';
import {
  createFountainObject,
  encodeSymbol,
  FOUNTAIN_OBJECT_HEADER_BYTES,
  FountainDecoder,
  readFountainObject,
  type FountainObject,
} from '@/lib/share/fountain';

export type ShareProfileId = 'safe' | 'fast' | 'turbo' | 'max';

export type ShareProfile = {
  id: ShareProfileId;
  /** 프레임에 실리는 1글자. 수신이 첫 디코드로 레인 수를 알아내는 데 쓴다. */
  code: string;
  label: string;
  /** 동시에 표시하는 QR 개수. 표시 문제일 뿐이라 프레임에 기하를 싣지 않는다(§scan-loop). */
  lanes: 1 | 2;
  /** qrcode-generator 버전. 고정이므로 프레임이 커지면 인코더가 조용히 넘어가지 않고 throw한다. */
  typeNumber: number;
  level: 'L' | 'M';
  blockBytes: number;
  /** 전 레인 합산 목표 */
  targetSymbolsPerSecond: number;
};

/**
 * blockBytes는 각 버전/EC 레벨의 alphanumeric 용량에서 프레임 헤더 26자를 뺀 자리에 들어가는
 * 최대값이다(base45는 2바이트 → 3자, 프레임 CRC 4바이트 포함). 왼쪽이 쓸 수 있는 자리, 오른쪽이
 * 실제로 쓰는 자리다 — base45는 3자 단위라 남는 0~2자는 채울 수 없다.
 *   V16-M  656자 - 26 = 630자  ← base45(416 + 4)  = 630자
 *   V25-L 1853자 - 26 = 1827자 ← base45(1214 + 4) = 1827자
 *   V30-L 2520자 - 26 = 2494자 ← base45(1658 + 4) = 2493자
 *   V40-L 4296자 - 26 = 4270자 ← base45(2842 + 4) = 4269자
 * share-frames.test.ts가 네 프로파일의 실제 프레임을 `qrcode(typeNumber, level)`로 인코딩해
 * 검증한다. 블록을 2바이트만 늘려도(=3자) 라이브러리가 throw한다.
 *
 * `turbo`·`max`는 네이티브 디코더(BarcodeDetector)에서만 `fast`보다 빠르다. jsQR 워커 경로에서는
 * turbo가 fast와 사실상 같고 max는 더 느리다(수치는 README의 프로파일 표 한 곳에만 둔다 — 여기에
 * 복제하면 재측정할 때마다 두 곳이 어긋난다). 숨기지 말고 옵션 설명에 적을 것(send-panel).
 */
const PROFILES: Record<ShareProfileId, ShareProfile> = {
  safe: {
    id: 'safe',
    code: 'S',
    label: '안정',
    lanes: 1,
    typeNumber: 16,
    level: 'M',
    blockBytes: 416,
    targetSymbolsPerSecond: 10,
  },
  fast: {
    id: 'fast',
    code: 'F',
    label: '빠르게',
    lanes: 1,
    typeNumber: 25,
    level: 'L',
    blockBytes: 1214,
    targetSymbolsPerSecond: 20,
  },
  turbo: {
    id: 'turbo',
    code: 'T',
    label: '고속',
    lanes: 1,
    typeNumber: 30,
    level: 'L',
    blockBytes: 1658,
    targetSymbolsPerSecond: 30,
  },
  max: {
    id: 'max',
    code: 'M',
    label: '최대',
    lanes: 2,
    typeNumber: 40,
    level: 'L',
    blockBytes: 2842,
    targetSymbolsPerSecond: 60,
  },
};

export const SHARE_PROFILES: readonly ShareProfile[] = [PROFILES.safe, PROFILES.fast, PROFILES.turbo, PROFILES.max];
export const DEFAULT_SHARE_PROFILE_ID: ShareProfileId = 'fast';

export function shareProfile(id: ShareProfileId): ShareProfile {
  return PROFILES[id];
}

/** 프레임의 CODE 한 글자 → 프로파일. 수신이 레인 수를 알아내는 유일한 경로다. */
export function shareProfileByCode(code: string): ShareProfile | null {
  return SHARE_PROFILES.find(profile => profile.code === code) ?? null;
}

/** 이론 초당 바이트. 실측이 아니므로 UI 문구에서 "이론"을 빼지 말 것. */
export function profileBytesPerSecond(profile: ShareProfile): number {
  return profile.targetSymbolsPerSecond * profile.blockBytes;
}

/**
 * 레인 하나가 한 심볼을 몇 refresh 유지할지. 실측 fps에서 유도하므로 120Hz 기기에서 두 배로
 * 빨라지지 않는다. 레인은 refresh를 나눠 쓰므로(레인 l은 `frame % hold === l`) hold가 레인 수보다
 * 작아지면 마지막 레인이 영원히 갱신되지 않는다. 그래서 하한이 1이 아니라 `lanes`다.
 */
export function profileHoldFrames(profile: ShareProfile, displayFps: number): number {
  const hold = Math.round(displayFps / (profile.targetSymbolsPerSecond / profile.lanes));
  return hold >= profile.lanes ? hold : profile.lanes;
}

const FRAME_PREFIX = 'MK3';
const CRC_BYTES = 4;
const ID_CHARS = 8;
/** K ≤ MAX_FOUNTAIN_BLOCKS(1024) < 36^3. 자릿수를 고정해 프레임 길이를 프로파일 안에서 불변으로 만든다. */
const BLOCK_COUNT_CHARS = 3;
/** 36^7 심볼. 풀이 유한하므로 실제로는 앞의 몇 자리만 쓰지만 폭은 고정한다. */
const SYMBOL_INDEX_CHARS = 7;
/** `MK3:` + CODE + ID + `:` + K + `:` + N + `:` = 26자. 위 용량 표가 이 값을 반영해 계산됐다. */
const FRAME_HEADER_CHARS = FRAME_PREFIX.length + 1 + 1 + ID_CHARS + 1 + BLOCK_COUNT_CHARS + 1 + SYMBOL_INDEX_CHARS + 1;
const FRAME_PATTERN = /^MK3:([SFTM])([0-9A-F]{8}):([0-9A-Z]{1,3}):([0-9A-Z]{1,7}):([-A-Z0-9 $%*+./:]+)$/u;
const LEGACY_FRAME_PREFIXES = ['MK1|', 'MK2:'] as const;

const LEGACY_FRAME_MESSAGE =
  '보내는 기기의 앱이 오래된 버전입니다. 새로 고친 뒤 다시 시도하거나 공유 파일을 이용해 주세요.';
const TOO_LARGE_TO_SEND = 'QR로 보내기에는 데이터가 너무 큽니다. 공유 파일을 이용해 주세요.';
const DECOMPRESSED_TOO_LARGE = '압축을 푼 공유 데이터가 24MB를 넘습니다.';
const INCOMPLETE = '아직 받지 못한 QR 조각이 있습니다.';

// ponytail: optical QR transfer is capped at about 384 KiB compressed; add a
// temporary relay only if real libraries outgrow the included share-file fallback.
/** 압축 후 상한. 가장 작은 blockBytes(safe 416)에서도 K ≤ MAX_FOUNTAIN_BLOCKS다. */
export const MAX_QR_SHARE_BYTES = 393_216;

/** `MK3:{CODE}{ID}:{K}:{N}:{PAYLOAD}` 한 프레임의 문자 수. 스트림 전체가 이 길이로 고정된다. */
export function shareFrameChars(profile: ShareProfile): number {
  return FRAME_HEADER_CHARS + base45Length(profile.blockBytes + CRC_BYTES);
}

const MAX_FRAME_CHARS = Math.max(...SHARE_PROFILES.map(profile => shareFrameChars(profile)));

function base36(value: number, width: number): string {
  return value.toString(36).toUpperCase().padStart(width, '0');
}

function uint32Bytes(value: number): Uint8Array {
  const bytes = new Uint8Array(CRC_BYTES);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
}

/**
 * 프레임 CRC는 `[N을 uint32 BE로 쓴 4바이트] || symbol`에 대해 계산한다.
 * 인덱스가 한 글자 뒤집히면 마스크가 달라져 손상 심볼과 똑같이 XOR 소거를 오염시키므로 함께 덮는다.
 */
function frameChecksum(index: number, symbol: Uint8Array): number {
  return crc32(concatBytes([uint32Bytes(index), symbol], CRC_BYTES + symbol.byteLength));
}

export type ShareFrameStream = {
  profile: ShareProfile;
  id: string;
  /** K */
  blockCount: number;
  /** 압축 후 바이트 */
  payloadBytes: number;
  objectBytes: number;
  /** 미리 구울 심볼 개수 */
  poolSize: number;
  /** index는 0..poolSize-1. 같은 index는 항상 같은 문자열 */
  frameAt(index: number): string;
};

/**
 * ponytail: 사전 인코딩 풀은 유한하다. 순서대로 순환하면 표시 프레임의 비율 f를 잡는 수신이
 * 한 바퀴에 f·poolSize개의 서로 다른 심볼을 모으므로, 25% 여유는 f ≥ 0.8에서 한 바퀴에 끝낸다.
 * 천장: K=39 실측으로 f=1.0은 0.80바퀴, f=0.8은 0.96바퀴(표시 1.15배)지만
 * f가 더 낮아지면 같은 심볼이 반복돼 꼬리가 길다(f=0.6은 1.8바퀴, f=0.4는 5.4바퀴).
 * 업그레이드 경로: 초당 60장을 실시간으로 굽는 WASM 인코더를 넣으면 무한 스트림으로 되돌린다.
 */
function poolSizeFor(blockCount: number): number {
  const size = blockCount + Math.max(8, Math.ceil(blockCount / 4));
  /**
   * 불변식은 `gcd(lanes, poolSize) === 1`이다. 레인들은 하나의 cursor를 나눠 쓰며 한 칸씩
   * 올라가므로 레인 하나가 밟는 인덱스의 보폭이 정확히 `lanes`가 된다. 최대 레인 수가 2인 지금은
   * "홀수"가 그 불변식과 같은 말이다 — 레인이 3개가 되면 이 한 줄로는 부족하다.
   * 짝수면 레인 0은 짝수 인덱스, 레인 1은 홀수 인덱스에 영원히 고정되고, 한쪽 레인만 보이는 수신은
   * 최대 poolSize/2개(약 0.625K)까지만 모아 랭크 K에 도달하지 못한다.
   * 풀은 커지기만 하므로 어떤 용량 주장도 후퇴하지 않는다.
   */
  return size % 2 === 0 ? size + 1 : size;
}

export async function createShareFrameStream(
  bundle: KaraokeShareBundle,
  profile: ShareProfile
): Promise<ShareFrameStream> {
  const payload = await compressBytes(
    serializeKaraokeShareBundle(bundle),
    // 13바이트 헤더도 블록 0 안에 들어가므로 상한에서 미리 빼둔다. 빼지 않으면 경계값에서 K가 넘친다.
    MAX_QR_SHARE_BYTES - FOUNTAIN_OBJECT_HEADER_BYTES,
    TOO_LARGE_TO_SEND
  );
  const object = await createFountainObject(payload, profile.blockBytes);
  const blockCountText = base36(object.blockCount, BLOCK_COUNT_CHARS);

  return {
    profile,
    id: object.id,
    blockCount: object.blockCount,
    payloadBytes: object.payloadBytes,
    objectBytes: object.data.byteLength,
    poolSize: poolSizeFor(object.blockCount),
    frameAt: index => frameText(object, profile, blockCountText, index),
  };
}

function frameText(object: FountainObject, profile: ShareProfile, blockCountText: string, index: number): string {
  const symbol = encodeSymbol(object, index);
  const payload = bytesToBase45(
    concatBytes([symbol, uint32Bytes(frameChecksum(index, symbol))], symbol.byteLength + CRC_BYTES)
  );
  const header = `${FRAME_PREFIX}:${profile.code}${object.id}:${blockCountText}:${base36(index, SYMBOL_INDEX_CHARS)}`;
  return `${header}:${payload}`;
}

type ParsedShareFrame = {
  profileCode: string;
  id: string;
  blockCount: number;
  blockBytes: number;
  index: number;
  symbol: Uint8Array;
};

/** 읽을 수 없는 프레임은 throw하지 않고 null이다(스캔 중에는 깨진 프레임이 정상적으로 섞인다). */
function parseShareFrame(text: string): ParsedShareFrame | null {
  if (text.length > MAX_FRAME_CHARS) return null;
  const match = FRAME_PATTERN.exec(text);
  if (!match) return null;

  const blockCount = Number.parseInt(match[3]!, 36);
  const index = Number.parseInt(match[4]!, 36);
  if (blockCount < 1) return null;

  let bytes: Uint8Array;
  try {
    bytes = base45ToBytes(match[5]!);
  } catch {
    return null;
  }

  const blockBytes = bytes.byteLength - CRC_BYTES;
  if (blockBytes < 1) return null;
  const symbol = bytes.subarray(0, blockBytes);
  const declared = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(blockBytes, false);
  if (frameChecksum(index, symbol) !== declared) return null;

  return { profileCode: match[1]!, id: match[2]!, blockCount, blockBytes, index, symbol };
}

export type ShareCollectorProgress = {
  id: string | null;
  /** 첫 디코드에서 알아낸 보내는 쪽 프로파일 코드 */
  profileCode: string | null;
  rank: number;
  blockCount: number;
  objectBytes: number;
  /** 프레임 파싱까지 성공한 누적 수 */
  acceptedSymbols: number;
  /** CRC 실패·포맷 오류로 버린 누적 수 */
  droppedSymbols: number;
  complete: boolean;
};

export class ShareFrameCollector {
  private decoder: FountainDecoder | null = null;
  private transferId: string | null = null;
  private code: string | null = null;
  private blockCount = 0;
  private blockBytes = 0;
  private accepted = 0;
  private dropped = 0;

  get progress(): ShareCollectorProgress {
    return {
      id: this.transferId,
      profileCode: this.code,
      rank: this.decoder?.rank ?? 0,
      blockCount: this.blockCount,
      objectBytes: this.blockCount * this.blockBytes,
      acceptedSymbols: this.accepted,
      droppedSymbols: this.dropped,
      complete: this.complete,
    };
  }

  get complete(): boolean {
    return this.decoder?.complete ?? false;
  }

  /**
   * 알 수 없는 포맷·CRC 실패는 throw하지 않고 droppedSymbols만 올린다.
   * MK1/MK2 구버전 프레임과 K 초과만 throw한다.
   */
  add(text: string): ShareCollectorProgress {
    if (LEGACY_FRAME_PREFIXES.some(prefix => text.startsWith(prefix))) throw new Error(LEGACY_FRAME_MESSAGE);

    const frame = parseShareFrame(text);
    if (!frame) {
      this.dropped += 1;
      return this.progress;
    }

    this.decoderFor(frame).add(frame.index, frame.symbol);
    this.accepted += 1;
    return this.progress;
  }

  reset(): void {
    this.decoder = null;
    this.transferId = null;
    this.code = null;
    this.blockCount = 0;
    this.blockBytes = 0;
    this.accepted = 0;
    this.dropped = 0;
  }

  /** complete일 때만. digest 검증 → 압축 해제 → 번들 파싱 */
  async decode(): Promise<KaraokeShareBundle> {
    if (!this.decoder) throw new Error(INCOMPLETE);
    const payload = await readFountainObject(this.decoder.recover());
    return parseKaraokeShareText(await decompressText(payload, MAX_SHARE_FILE_BYTES, DECOMPRESSED_TOO_LARGE));
  }

  /** 오브젝트가 바뀌면(ID) 물론이고 블록 구성이 바뀌어도(보내는 쪽 프로파일 변경) 처음부터 다시 모은다. */
  private decoderFor(frame: ParsedShareFrame): FountainDecoder {
    if (
      this.decoder &&
      frame.id === this.transferId &&
      frame.blockCount === this.blockCount &&
      frame.blockBytes === this.blockBytes
    ) {
      return this.decoder;
    }

    // K 초과는 여기서 throw한다. reset보다 먼저 만들어야, 넘치는 프레임 하나가
    // 이미 모으고 있던 전송을 날려버리지 않는다.
    const decoder = new FountainDecoder(frame.blockCount, frame.blockBytes);
    this.reset();
    this.decoder = decoder;
    this.transferId = frame.id;
    this.code = frame.profileCode;
    this.blockCount = frame.blockCount;
    this.blockBytes = frame.blockBytes;
    return decoder;
  }
}
