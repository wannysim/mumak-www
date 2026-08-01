import type { QrMatrix } from '@/lib/share/qr-matrix';

/** QR 사양 최소 quiet zone. 더 좁히면 스캐너가 심볼 경계를 찾지 못한다. */
export const QR_QUIET_MODULES = 4;

/**
 * 행 우선 비트셋에서 모듈 하나를 읽는다. 순수 비트 연산이라 `qr-matrix.ts`(=`qrcode-generator`)에
 * 기대지 않는다. 인코더를 여기로 끌고 오면 워커 청크와 앱 셸에 같은 라이브러리가 두 벌 실린다.
 */
export function isQrModuleDark({ moduleCount, bits }: QrMatrix, row: number, column: number): boolean {
  const index = row * moduleCount + column;
  return (bits[index >>> 3]! & (0x80 >>> (index & 7))) !== 0;
}

/**
 * ponytail: 모듈 해상도 소스 캔버스를 모듈 스코프에 하나만 두고 재사용한다. 표시 루프가 초당 60번
 * 부르므로 프레임마다 createElement를 하면 GC가 표시 루프를 잡아먹는다.
 * 천장: 두 레인이 같은 소스를 같은 틱 안에서 순차로 쓴다(putImageData → drawImage가 동기라 안전).
 * 업그레이드 경로: 레인 렌더를 OffscreenCanvas로 워커에 넘길 때 레인별 소스로 쪼갠다.
 */
let moduleCanvas: HTMLCanvasElement | null = null;

/** 모듈 하나 = 소스 픽셀 하나. quiet zone까지 포함한 정사각형을 흰 배경 위에 그린다. */
function drawModules(matrix: QrMatrix, quietModules: number, total: number): HTMLCanvasElement | null {
  moduleCanvas ??= document.createElement('canvas');
  const context = moduleCanvas.getContext('2d');
  if (!context) return null;

  moduleCanvas.width = total;
  moduleCanvas.height = total;
  const image = context.createImageData(total, total);
  // 바이트로 채워 엔디안에 의존하지 않는다. 흰색은 RGBA 전부 255, 검은 모듈은 알파만 남긴다.
  image.data.fill(255);
  for (let row = 0; row < matrix.moduleCount; row += 1) {
    const rowOffset = (row + quietModules) * total + quietModules;
    for (let column = 0; column < matrix.moduleCount; column += 1) {
      if (!isQrModuleDark(matrix, row, column)) continue;
      const pixel = (rowOffset + column) * 4;
      image.data[pixel] = 0;
      image.data[pixel + 1] = 0;
      image.data[pixel + 2] = 0;
    }
  }
  context.putImageData(image, 0, 0);

  return moduleCanvas;
}

function pixelRatio(): number {
  return window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
}

/** 모듈 해상도 ImageData를 정수 배율로만 확대한다. 보간은 끈다. */
export function blitQrMatrix(canvas: HTMLCanvasElement, matrix: QrMatrix, quietModules: number): void {
  const context = canvas.getContext('2d');
  const total = matrix.moduleCount + quietModules * 2;
  const source = drawModules(matrix, quietModules, total);
  if (!context || !source) return;

  /**
   * 비정수 배율은 모듈 폭을 2px/3px로 들쭉날쭉하게 만들어 스캔 품질을 떨어뜨린다.
   * CSS 크기 × devicePixelRatio를 내림해 정수로 고정한다.
   */
  const ratio = pixelRatio();
  const size = total * Math.max(1, Math.floor((canvas.clientWidth * ratio) / total));
  if (canvas.width !== size || canvas.height !== size) {
    canvas.width = size;
    canvas.height = size;
  }
  // 백킹 스토어만 정수로 맞추고 CSS 박스를 놔두면 컴포지터가 비정수 배율로 다시 늘려 방금 맞춘
  // 모듈 격자를 도로 무너뜨린다. 인라인 스타일로 박스를 백킹 스토어에 못 박고 남는 폭은 여백으로 둔다.
  canvas.style.width = `${size / ratio}px`;
  canvas.style.height = canvas.style.width;
  // canvas.width 대입이 컨텍스트 상태를 초기화하므로 보간 해제는 리사이즈 뒤에 한다.
  context.imageSmoothingEnabled = false;
  context.drawImage(source, 0, 0, total, total, 0, 0, size, size);
}
