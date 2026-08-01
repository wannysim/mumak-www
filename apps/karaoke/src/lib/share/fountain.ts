import { concatBytes, ownedArrayBuffer } from '@/lib/share/codec';

/** `[버전 1B][압축 페이로드 길이 uint32 BE 4B][SHA-256(페이로드) 앞 8B]` */
export const FOUNTAIN_OBJECT_HEADER_BYTES = 13;
/**
 * 후방 대입이 O(K^2) 행 XOR이므로 K를 묶어 최악 비용을 1초 미만으로 유지한다.
 * 이 값을 넘는 오브젝트는 생성·수신 양쪽에서 거부한다.
 */
export const MAX_FOUNTAIN_BLOCKS = 1024;

const FOUNTAIN_VERSION = 0x03;
const PAYLOAD_LENGTH_OFFSET = 1;
const DIGEST_OFFSET = 5;
const DIGEST_PREFIX_BYTES = 8;
const OBJECT_ID_BYTES = 4;
const MASK_SEED_MULTIPLIER = 0x9e37_79b1;

const TOO_LARGE_TO_SEND = 'QR로 보내기에는 데이터가 너무 큽니다. 공유 파일을 이용해 주세요.';
const TOO_LARGE_TO_RECEIVE = 'QR 데이터가 너무 커서 받을 수 없습니다. 공유 파일을 이용해 주세요.';
const MALFORMED_OBJECT = 'QR 데이터의 형식이 올바르지 않습니다.';
const CORRUPTED_OBJECT = 'QR 데이터의 무결성 검사를 통과하지 못했습니다.';
const WRONG_SYMBOL_LENGTH = 'QR 조각의 데이터 길이가 올바르지 않습니다.';
const INCOMPLETE = '아직 받지 못한 QR 조각이 있습니다.';
const INVALID_LAYOUT = 'QR 데이터의 블록 구성이 올바르지 않습니다.';

export type FountainObject = {
  /** `blockCount * blockBytes` 바이트. 헤더 + 압축 페이로드 + 0 패딩 */
  data: Uint8Array;
  blockBytes: number;
  blockCount: number;
  payloadBytes: number;
  /** digest 앞 4바이트의 대문자 hex 8자 */
  id: string;
};

async function digestPrefix(payload: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', ownedArrayBuffer(payload));
  return new Uint8Array(digest, 0, DIGEST_PREFIX_BYTES);
}

function upperHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((value, index) => value === right[index]);
}

function assertBlockLayout(blockCount: number, blockBytes: number, tooLargeMessage: string): void {
  if (!Number.isInteger(blockBytes) || blockBytes < 1) throw new Error(INVALID_LAYOUT);
  if (!Number.isInteger(blockCount) || blockCount < 1) throw new Error(INVALID_LAYOUT);
  if (blockCount > MAX_FOUNTAIN_BLOCKS) throw new Error(tooLargeMessage);
}

export async function createFountainObject(payload: Uint8Array, blockBytes: number): Promise<FountainObject> {
  const payloadBytes = payload.byteLength;
  const objectBytes = FOUNTAIN_OBJECT_HEADER_BYTES + payloadBytes;
  const blockCount = Number.isInteger(blockBytes) && blockBytes >= 1 ? Math.ceil(objectBytes / blockBytes) : 0;
  assertBlockLayout(blockCount, blockBytes, TOO_LARGE_TO_SEND);

  const digest = await digestPrefix(payload);
  const header = new Uint8Array(FOUNTAIN_OBJECT_HEADER_BYTES);
  header[0] = FOUNTAIN_VERSION;
  new DataView(header.buffer).setUint32(PAYLOAD_LENGTH_OFFSET, payloadBytes, false);
  header.set(digest, DIGEST_OFFSET);

  return {
    data: concatBytes([header, payload], blockCount * blockBytes),
    blockBytes,
    blockCount,
    payloadBytes,
    id: upperHex(digest.subarray(0, OBJECT_ID_BYTES)),
  };
}

/** 헤더 검증 + digest 검증 후 압축 페이로드만 잘라 반환 */
export async function readFountainObject(data: Uint8Array): Promise<Uint8Array> {
  if (data.byteLength < FOUNTAIN_OBJECT_HEADER_BYTES) throw new Error(MALFORMED_OBJECT);
  if (data[0] !== FOUNTAIN_VERSION) throw new Error(MALFORMED_OBJECT);

  const payloadBytes = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(
    PAYLOAD_LENGTH_OFFSET,
    false
  );
  const payloadEnd = FOUNTAIN_OBJECT_HEADER_BYTES + payloadBytes;
  if (payloadEnd > data.byteLength) throw new Error(MALFORMED_OBJECT);

  const payload = data.slice(FOUNTAIN_OBJECT_HEADER_BYTES, payloadEnd);
  const declared = data.subarray(DIGEST_OFFSET, DIGEST_OFFSET + DIGEST_PREFIX_BYTES);
  if (!sameBytes(declared, await digestPrefix(payload))) throw new Error(CORRUPTED_OBJECT);
  return payload;
}

/**
 * mulberry32. 송신·수신이 같은 마스크를 얻어야 하는 와이어 계약이므로 절대 바꾸지 않는다.
 * 바꾸면 구버전 기기와 서로 복원할 수 없다.
 */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b_79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function maskWordCount(blockCount: number): number {
  return Math.ceil(blockCount / 32);
}

function hasMaskBit(mask: Uint32Array, index: number): boolean {
  return (mask[index >>> 5]! & (1 << (index & 31))) !== 0;
}

function setMaskBit(mask: Uint32Array, index: number): void {
  const word = index >>> 5;
  mask[word] = mask[word]! | (1 << (index & 31));
}

function xorWords(target: Uint32Array, source: Uint32Array): void {
  for (let index = 0; index < target.length; index += 1) target[index] = target[index]! ^ source[index]!;
}

function xorBytes(target: Uint8Array, source: Uint8Array, sourceOffset = 0): void {
  for (let index = 0; index < target.length; index += 1) {
    target[index] = target[index]! ^ source[sourceOffset + index]!;
  }
}

/** blockCount 비트 마스크. index < blockCount면 systematic(비트 index만) */
export function symbolMask(index: number, blockCount: number): Uint32Array {
  const mask = new Uint32Array(maskWordCount(blockCount));
  if (index < blockCount) {
    setMaskBit(mask, index);
    return mask;
  }

  const random = createRandom(Math.imul(index + 1, MASK_SEED_MULTIPLIER) >>> 0);
  let setBits = 0;
  for (let block = 0; block < blockCount; block += 1) {
    if (random() < 0.5) {
      setMaskBit(mask, block);
      setBits += 1;
    }
  }
  if (setBits === 0) setMaskBit(mask, 0);
  return mask;
}

/** 마스크에 걸린 블록들의 XOR (길이 blockBytes) */
export function encodeSymbol(object: FountainObject, index: number): Uint8Array {
  const mask = symbolMask(index, object.blockCount);
  const symbol = new Uint8Array(object.blockBytes);
  for (let block = 0; block < object.blockCount; block += 1) {
    if (hasMaskBit(mask, block)) xorBytes(symbol, object.data, block * object.blockBytes);
  }
  return symbol;
}

type PivotRow = { mask: Uint32Array; data: Uint8Array };

/**
 * GF(2) 가우스 소거를 심볼이 들어올 때마다 진행한다.
 * 불변식: `pivotRows[p]`의 마스크는 최하위 세트 비트가 정확히 p다.
 * 그래서 그 행으로 XOR하면 비트 p는 지워지고 p보다 큰 비트만 변하므로
 * p를 0부터 올려가는 한 번의 스캔으로 소거가 끝난다.
 */
export class FountainDecoder {
  private readonly blockCount: number;
  private readonly blockBytes: number;
  private readonly pivotRows: Array<PivotRow | undefined>;
  private solvedRank = 0;

  constructor(blockCount: number, blockBytes: number) {
    assertBlockLayout(blockCount, blockBytes, TOO_LARGE_TO_RECEIVE);
    this.blockCount = blockCount;
    this.blockBytes = blockBytes;
    this.pivotRows = Array.from({ length: blockCount });
  }

  get rank(): number {
    return this.solvedRank;
  }

  get complete(): boolean {
    return this.solvedRank === this.blockCount;
  }

  /** 랭크가 올라갔으면 true, 선형 종속이면 false */
  add(index: number, symbol: Uint8Array): boolean {
    if (symbol.byteLength !== this.blockBytes) throw new Error(WRONG_SYMBOL_LENGTH);

    const mask = symbolMask(index, this.blockCount);
    const data = symbol.slice();
    for (let pivot = 0; pivot < this.blockCount; pivot += 1) {
      if (!hasMaskBit(mask, pivot)) continue;
      const row = this.pivotRows[pivot];
      if (!row) {
        this.pivotRows[pivot] = { mask, data };
        this.solvedRank += 1;
        return true;
      }
      xorWords(mask, row.mask);
      xorBytes(data, row.data);
    }
    return false;
  }

  /** complete일 때만. `blockCount * blockBytes` 바이트 */
  recover(): Uint8Array {
    if (!this.complete) throw new Error(INCOMPLETE);

    const solution = new Uint8Array(this.blockCount * this.blockBytes);
    // ponytail: 후방 대입에서 마스크를 비트 단위로 훑어 최악 K^2 = 100만 회 검사다.
    // K 상한을 1024 위로 올릴 일이 생기면 워드 단위(clz32) 순회로 바꾼다.
    for (let pivot = this.blockCount - 1; pivot >= 0; pivot -= 1) {
      const row = this.pivotRows[pivot]!;
      const block = row.data.slice();
      for (let higher = pivot + 1; higher < this.blockCount; higher += 1) {
        if (hasMaskBit(row.mask, higher)) xorBytes(block, solution, higher * this.blockBytes);
      }
      solution.set(block, pivot * this.blockBytes);
    }
    return solution;
  }
}
