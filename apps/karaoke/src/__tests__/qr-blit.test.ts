import { beforeEach, describe, expect, it } from 'vitest';

import { blitQrMatrix, isQrModuleDark, QR_QUIET_MODULES } from '../lib/share/qr-blit';
import { encodeQrMatrix, type QrMatrix } from '../lib/share/qr-matrix';

type FakeContext = {
  imageSmoothingEnabled: boolean;
  lastImage: ImageData | null;
  drawCalls: unknown[][];
  createImageData(width: number, height: number): ImageData;
  putImageData(image: ImageData, x: number, y: number): void;
  drawImage(...args: unknown[]): void;
};

const contexts = new WeakMap<HTMLCanvasElement, FakeContext>();
let contextAvailable = true;

/** jsdom에는 2D 컨텍스트가 없다. blit이 실제로 쓰는 네 가지 동작만 기록하는 대역을 끼운다. */
function createFakeContext(): FakeContext {
  return {
    imageSmoothingEnabled: true,
    lastImage: null,
    drawCalls: [],
    createImageData(width, height) {
      return { width, height, data: new Uint8ClampedArray(width * height * 4) } as unknown as ImageData;
    },
    putImageData(image) {
      this.lastImage = image;
    },
    drawImage(...args) {
      this.drawCalls.push(args);
    },
  };
}

function contextOf(canvas: HTMLCanvasElement): FakeContext {
  const context = contexts.get(canvas);
  if (!context) throw new Error('컨텍스트를 만들지 않은 캔버스다.');
  return context;
}

function createTargetCanvas(cssWidth: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: cssWidth, configurable: true });
  return canvas;
}

function setDevicePixelRatio(ratio: number): void {
  Object.defineProperty(window, 'devicePixelRatio', { value: ratio, configurable: true });
}

/** drawImage에 넘어간 소스 캔버스(모듈 해상도)와 그 위에 올라간 ImageData를 꺼낸다. */
function sourceImage(target: HTMLCanvasElement): ImageData {
  const [call] = contextOf(target).drawCalls;
  const source = call?.[0];
  if (!(source instanceof HTMLCanvasElement)) throw new Error('drawImage 소스가 캔버스가 아니다.');
  const image = contextOf(source).lastImage;
  if (!image) throw new Error('소스 캔버스에 putImageData가 없었다.');
  return image;
}

function pixelIsDark(image: ImageData, row: number, column: number): boolean {
  return image.data[(row * image.width + column) * 4] === 0;
}

let matrix: QrMatrix;
let total: number;

beforeEach(() => {
  contextAvailable = true;
  setDevicePixelRatio(2);
  matrix = encodeQrMatrix('HELLO WORLD', 2, 'M');
  total = matrix.moduleCount + QR_QUIET_MODULES * 2;

  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
    if (!contextAvailable) return null;
    let context = contexts.get(this);
    if (!context) {
      context = createFakeContext();
      contexts.set(this, context);
    }
    return context;
  } as unknown as HTMLCanvasElement['getContext'];
});

describe('blitQrMatrix', () => {
  it('scales the module grid by an integer factor with smoothing disabled', () => {
    const canvas = createTargetCanvas(300);

    blitQrMatrix(canvas, matrix, QR_QUIET_MODULES);

    // 600 디바이스 픽셀 / 33모듈 = 18.18 → 18. 모듈마다 정확히 18px이라 폭이 들쭉날쭉해지지 않는다.
    expect(canvas.width).toBe(total * 18);
    expect(canvas.height).toBe(total * 18);
    expect(canvas.width % total).toBe(0);
    // CSS 박스를 백킹 스토어에 못 박지 않으면 컴포지터가 300 / 297 = 1.01배로 다시 늘려
    // 방금 맞춘 정수 모듈 격자를 화면에서 무너뜨린다.
    expect(canvas.style.width).toBe(`${(total * 18) / 2}px`);
    expect(canvas.style.height).toBe(canvas.style.width);

    const context = contextOf(canvas);
    expect(context.imageSmoothingEnabled).toBe(false);
    expect(context.drawCalls).toHaveLength(1);
    expect(context.drawCalls[0]?.slice(1)).toEqual([0, 0, total, total, 0, 0, total * 18, total * 18]);
  });

  it('rounds the scale down so the canvas never fits a fractional module', () => {
    setDevicePixelRatio(1);
    const canvas = createTargetCanvas(200);

    blitQrMatrix(canvas, matrix, QR_QUIET_MODULES);

    expect(canvas.width).toBe(total * 6);
    expect(canvas.width).toBeLessThanOrEqual(200);
    expect(canvas.width % total).toBe(0);
  });

  it('treats a missing devicePixelRatio as one device pixel per css pixel', () => {
    setDevicePixelRatio(0);
    const canvas = createTargetCanvas(200);

    blitQrMatrix(canvas, matrix, QR_QUIET_MODULES);

    expect(canvas.width).toBe(total * 6);
  });

  it('keeps the same backing store across frames so the display loop does not resize every blit', () => {
    const canvas = createTargetCanvas(300);

    blitQrMatrix(canvas, matrix, QR_QUIET_MODULES);
    blitQrMatrix(canvas, encodeQrMatrix('MK3 SECOND FRAME', 2, 'M'), QR_QUIET_MODULES);

    // 크기 대입은 캔버스를 지우고 컨텍스트 상태를 초기화한다. 같은 크기면 건드리지 않아야 한다.
    expect(canvas.width).toBe(total * 18);
    expect(contextOf(canvas).drawCalls).toHaveLength(2);
    expect(contextOf(canvas).imageSmoothingEnabled).toBe(false);
  });

  it('falls back to one pixel per module while the canvas has no layout size', () => {
    const canvas = createTargetCanvas(0);

    blitQrMatrix(canvas, matrix, QR_QUIET_MODULES);

    expect(canvas.width).toBe(total);
  });

  it('keeps a four module quiet zone around the symbol', () => {
    expect(QR_QUIET_MODULES).toBe(4);
    const canvas = createTargetCanvas(300);

    blitQrMatrix(canvas, matrix, QR_QUIET_MODULES);

    const image = sourceImage(canvas);
    expect([image.width, image.height]).toEqual([total, total]);

    const inQuietZone = (position: number) => position < QR_QUIET_MODULES || position >= QR_QUIET_MODULES + 25;
    for (let row = 0; row < total; row += 1) {
      for (let column = 0; column < total; column += 1) {
        const expected =
          inQuietZone(row) || inQuietZone(column)
            ? false
            : isQrModuleDark(matrix, row - QR_QUIET_MODULES, column - QR_QUIET_MODULES);
        expect(pixelIsDark(image, row, column)).toBe(expected);
      }
    }
  });

  it('does nothing when the canvas has no 2d context', () => {
    contextAvailable = false;
    const canvas = createTargetCanvas(300);

    expect(() => blitQrMatrix(canvas, matrix, QR_QUIET_MODULES)).not.toThrow();
    expect(canvas.width).toBe(300);
  });
});
