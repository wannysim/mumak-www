import qrcode from 'qrcode-generator';

/** 행 우선, 1비트/모듈. V40(177²)이 3.9 KB이므로 사전 인코딩 풀 174개도 680 KB다. */
export type QrMatrix = { moduleCount: number; bits: Uint8Array };

/** qrcode-generator는 버전을 리터럴 유니온으로 받는다. 프로파일의 number를 그 폭으로 좁힌다. */
type QrTypeNumber = Parameters<typeof qrcode>[0];

function bitMask(index: number): number {
  return 0x80 >>> (index & 7);
}

/**
 * 비트를 읽는 쪽은 `qr-blit.ts`다. 그쪽에서 이 파일을 import하면 `qrcode-generator`가 워커 청크와
 * 앱 셸 양쪽에 실리므로, 읽기 함수는 여기 두지 않고 blit이 직접 갖는다.
 */

/**
 * MK3 프레임은 `MK3:`·대문자 hex·base45(`[-A-Z0-9 $%*+./:]`)로만 이루어져 전부 QR
 * alphanumeric 문자셋에 든다. 기본 Byte 모드로 두면 같은 버전의 용량이 절반 이하로 떨어져
 * 프로파일 blockBytes가 들어가지 않으므로 모드를 명시한다(소문자가 섞이면 라이브러리가 던진다).
 * `typeNumber`도 명시하므로 프레임이 커지면 버전이 조용히 올라가는 대신 throw한다.
 */
export function encodeQrMatrix(value: string, typeNumber: number, level: 'L' | 'M'): QrMatrix {
  const qr = qrcode(typeNumber as QrTypeNumber, level);
  qr.addData(value, 'Alphanumeric');
  qr.make();

  const moduleCount = qr.getModuleCount();
  const bits = new Uint8Array(Math.ceil((moduleCount * moduleCount) / 8));
  for (let row = 0; row < moduleCount; row += 1) {
    const rowOffset = row * moduleCount;
    for (let column = 0; column < moduleCount; column += 1) {
      if (!qr.isDark(row, column)) continue;
      const index = rowOffset + column;
      const byte = index >>> 3;
      bits[byte] = bits[byte]! | bitMask(index);
    }
  }

  return { moduleCount, bits };
}

/**
 * 워커 와이어 포맷. 로직을 전부 이 파일에 두고 `qr-encoder.worker.ts`는 배관만 담당한다
 * (워커는 jsdom에서 직접 테스트할 수 없다).
 */
export type QrEncodeRequest = { frames: string[]; startIndex: number; typeNumber: number; level: 'L' | 'M' };
export type QrEncodeResponse = { startIndex: number; moduleCount: number; bits: Uint8Array[] };

export function encodeQrBatch({ frames, startIndex, typeNumber, level }: QrEncodeRequest): QrEncodeResponse {
  // 호출자(use-share-frame-stream)가 워커 수를 poolSize로 묶고 batchSize를 1 아래로 내리지 않으므로
  // 빈 구간은 오지 않는다. 온다면 moduleCount를 지어내는 대신 여기서 터지는 편이 낫다.
  const matrices = frames.map(frame => encodeQrMatrix(frame, typeNumber, level));

  return {
    startIndex,
    moduleCount: matrices[0]!.moduleCount,
    bits: matrices.map(matrix => matrix.bits),
  };
}
