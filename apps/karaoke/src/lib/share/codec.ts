// RFC 9285 keeps binary payloads in QR Alphanumeric mode: https://www.rfc-editor.org/rfc/rfc9285.html#section-4
const BASE45_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const UNSUPPORTED_COMPRESSION_MESSAGE = '이 브라우저는 QR 공유 압축을 지원하지 않습니다. 공유 파일을 이용해 주세요.';

const CRC32_TABLE = buildCrc32Table();

function buildCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let byte = 0; byte < table.length; byte += 1) {
    let value = byte;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
    }
    table[byte] = value >>> 0;
  }
  return table;
}

export function bytesToBase45(bytes: Uint8Array): string {
  let encoded = '';
  for (let index = 0; index < bytes.length; index += 2) {
    const first = bytes[index]!;
    if (index + 1 === bytes.length) {
      encoded += BASE45_ALPHABET[first % 45]! + BASE45_ALPHABET[Math.floor(first / 45)]!;
      break;
    }

    const value = first * 256 + bytes[index + 1]!;
    encoded +=
      BASE45_ALPHABET[value % 45]! +
      BASE45_ALPHABET[Math.floor(value / 45) % 45]! +
      BASE45_ALPHABET[Math.floor(value / 45 ** 2)]!;
  }
  return encoded;
}

export function base45ToBytes(value: string): Uint8Array {
  if (!value || value.length % 3 === 1) throw new Error('QR 조각의 문자 형식이 올바르지 않습니다.');
  const decoded = new Uint8Array(Math.floor(value.length / 3) * 2 + (value.length % 3 === 2 ? 1 : 0));
  let decodedIndex = 0;

  for (let index = 0; index < value.length; index += 3) {
    const groupLength = Math.min(3, value.length - index);
    const digits = Array.from({ length: groupLength }, (_, offset) => BASE45_ALPHABET.indexOf(value[index + offset]!));
    if (digits.some(digit => digit < 0)) throw new Error('QR 조각의 문자 형식이 올바르지 않습니다.');
    const number = digits[0]! + digits[1]! * 45 + (digits[2] ?? 0) * 45 ** 2;
    if (number > (groupLength === 3 ? 65_535 : 255)) throw new Error('QR 조각을 읽을 수 없습니다.');

    if (groupLength === 3) decoded[decodedIndex++] = Math.floor(number / 256);
    decoded[decodedIndex++] = number % 256;
  }
  return decoded;
}

/** 길이 byteLength 바이트를 base45로 인코딩한 문자열 길이 */
export function base45Length(byteLength: number): number {
  return Math.floor(byteLength / 2) * 3 + (byteLength % 2 === 1 ? 2 : 0);
}

/** IEEE 802.3 CRC-32 (reflected 0xEDB88320), unsigned 32bit */
export function crc32(bytes: Uint8Array): number {
  let remainder = 0xffffffff;
  for (const byte of bytes) {
    remainder = (remainder >>> 8) ^ CRC32_TABLE[(remainder ^ byte) & 0xff]!;
  }
  return (remainder ^ 0xffffffff) >>> 0;
}

export function concatBytes(chunks: readonly Uint8Array[], total: number): Uint8Array {
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export function ownedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

async function readStreamWithLimit(
  stream: ReadableStream<Uint8Array>,
  limit: number,
  tooLargeMessage: string
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new Error(tooLargeMessage);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return concatBytes(chunks, total);
}

/** deflate-raw 압축. gzip 대신 raw를 써서 헤더/트레일러 18바이트를 아낀다. */
export async function compressBytes(text: string, limit: number, tooLargeMessage: string): Promise<Uint8Array> {
  if (typeof CompressionStream !== 'function') throw new Error(UNSUPPORTED_COMPRESSION_MESSAGE);
  const stream = new Response(text).body?.pipeThrough(new CompressionStream('deflate-raw'));
  if (!stream) throw new Error('공유 데이터를 압축하지 못했습니다.');
  return readStreamWithLimit(stream, limit, tooLargeMessage);
}

export async function decompressText(bytes: Uint8Array, limit: number, tooLargeMessage: string): Promise<string> {
  if (typeof DecompressionStream !== 'function') throw new Error(UNSUPPORTED_COMPRESSION_MESSAGE);
  const stream = new Response(ownedArrayBuffer(bytes)).body?.pipeThrough(new DecompressionStream('deflate-raw'));
  if (!stream) throw new Error('공유 데이터의 압축을 풀지 못했습니다.');
  const decompressed = await readStreamWithLimit(stream, limit, tooLargeMessage);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(decompressed);
  } catch {
    throw new Error('공유 데이터의 문자 형식이 올바르지 않습니다.');
  }
}
