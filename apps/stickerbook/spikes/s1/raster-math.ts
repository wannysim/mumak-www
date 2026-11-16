// S1 하네스의 순수 계산. DOM·WebGL에 기대지 않는다.
// 근거: tech-research.md 1장(텍스처 해상도 = 쪽 CSS 크기 × 실제 DPR, 쉬는 카메라 텍셀:픽셀 1:1),
// spikes.md 공통 측정 방법(텍스처 메모리 = 폭 × 높이 × 4바이트).

export type Size = { width: number; height: number };
export type Point = { x: number; y: number };
export type PixelRect = { x: number; y: number; width: number; height: number };
export type BackingSize = Size & { exact: boolean };

const INTEGER_TOLERANCE = 1e-6;
const BYTES_PER_RGBA_TEXEL = 4;

/** 캔버스 백킹 크기 = CSS 크기 × 배율. 곱이 정수가 아니면 반올림하고 exact=false로 알린다. */
export function computeBackingSize(cssSize: Size, scale: number): BackingSize {
  const rawWidth = cssSize.width * scale;
  const rawHeight = cssSize.height * scale;
  const width = Math.max(1, Math.round(rawWidth));
  const height = Math.max(1, Math.round(rawHeight));
  const exact = Math.abs(width - rawWidth) < INTEGER_TOLERANCE && Math.abs(height - rawHeight) < INTEGER_TOLERANCE;
  return { width, height, exact };
}

/**
 * 드로잉 버퍼의 기기 픽셀 사각형을 clip 좌표 TRIANGLE_STRIP 정점 4개로 바꾼다.
 * 정점마다 (clipX, clipY, u, v). 텍스처 첫 행이 화면 위쪽이 되도록 v=0을 위에 둔다(UNPACK_FLIP_Y 끔).
 */
export function pixelRectToClipQuad(rect: PixelRect, viewport: Size): Float32Array {
  const left = (rect.x / viewport.width) * 2 - 1;
  const right = ((rect.x + rect.width) / viewport.width) * 2 - 1;
  const top = 1 - (rect.y / viewport.height) * 2;
  const bottom = 1 - ((rect.y + rect.height) / viewport.height) * 2;
  return new Float32Array([left, top, 0, 0, left, bottom, 0, 1, right, top, 1, 0, right, bottom, 1, 1]);
}

/** RGBA8 텍스처 한 장의 바이트 수(밉맵 없음). */
export function textureBytes(size: Size): number {
  return size.width * size.height * BYTES_PER_RGBA_TEXEL;
}

/**
 * 드로잉 버퍼 1픽셀에 들어가는 텍셀 수. 1이면 텍셀:드로잉 버퍼 픽셀 1:1.
 * 화면 1:1은 캔버스가 정수 기기 px에 놓일 때만 성립한다(devicePixelPlacement 참고).
 * 버퍼가 0×0이면(컨텍스트 손실 중) null.
 */
export function texelsPerPixel(textureSize: Size, drawnSize: Size): Size | null {
  if (drawnSize.width <= 0 || drawnSize.height <= 0) return null;
  return {
    width: textureSize.width / drawnSize.width,
    height: textureSize.height / drawnSize.height,
  };
}

export function sameSize(left: Size, right: Size): boolean {
  return left.width === right.width && left.height === right.height;
}

/** 사진 원본 폭 ÷ (사진 CSS 폭 × 배율). 1 미만이면 원본이 모자라 늘려 그린다(spikes.md S1-6). */
export function photoSourceCoverage(naturalWidth: number, cssWidth: number, scale: number): number {
  return naturalWidth / (cssWidth * scale);
}

function escapeXmlText(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export type FontFaceRuleInput = { family: string; dataUrl: string; weightRange: string };

/** SVG 안에서 쓸 @font-face. DOM 쪽 FontFace와 같은 바이트를 data URL로 싣는다. */
export function buildFontFaceRule(input: FontFaceRuleInput): string {
  return [
    '@font-face{',
    `font-family:"${input.family}";`,
    `src:url("${input.dataUrl}") format("woff2");`,
    `font-weight:${input.weightRange};`,
    'font-style:normal;',
    'font-display:block;',
    '}',
  ].join('');
}

export type ForeignObjectSvgInput = {
  cssSize: Size;
  /** SVG 고유 크기 배율. 1이면 고유 크기 = CSS 크기, 그 밖이면 viewBox로 키워 고유 크기 = 백킹 크기. */
  intrinsicScale: number;
  styleText: string;
  bodyMarkup: string;
  /** 같은 SVG URL의 디코드 캐시를 피하려고 넣는 래스터 번호. */
  rasterId: number;
};

/** 시험 쪽 XHTML과 CSS를 foreignObject SVG 문자열로 조립한다. */
export function buildForeignObjectSvg(input: ForeignObjectSvgInput): string {
  const { width, height } = input.cssSize;
  const intrinsic = computeBackingSize(input.cssSize, input.intrinsicScale);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${intrinsic.width}" height="${intrinsic.height}"`,
    ` viewBox="0 0 ${width} ${height}" data-s1-raster="${input.rasterId}">`,
    `<foreignObject x="0" y="0" width="${width}" height="${height}">`,
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;margin:0;padding:0">`,
    `<style>${escapeXmlText(input.styleText)}</style>`,
    input.bodyMarkup,
    '</div></foreignObject></svg>',
  ].join('');
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * 내용 영역 판정의 균일 상한(채널 값 폭). 글자(#1c1c1c 대 #e4e4e4)나 사진이 그려졌으면 폭이 이보다 훨씬 크다.
 * 하네스 판정용 임시값이다.
 */
const UNIFORM_CHANNEL_RANGE = 8;

export type RegionStats = {
  /** 모든 픽셀의 알파가 0. */
  transparent: boolean;
  /** RGBA 채널마다 (최대 − 최소)의 최댓값. */
  channelRange: number;
  /** channelRange가 UNIFORM_CHANNEL_RANGE 이하면 그 영역에 내용(글자·사진)이 그려지지 않은 것으로 본다. */
  uniform: boolean;
  /** 영역 바이트의 FNV-1a 32비트. 같은 SVG를 두 번 그린 결과가 같은지 비교한다. */
  fingerprint: string;
};

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * 위에서 아래로 쌓인 RGBA 버퍼(폭 bufferWidth)에서 rect 영역만 훑는다.
 * 알파만 보면 배경이 불투명한 쪽에서 글자·사진이 빠진 경우를 놓친다(WebKit 219770·39059 증상). 그래서 채널 폭으로 본다.
 */
export function analyzeRegion(rgba: ArrayLike<number>, bufferWidth: number, rect: PixelRect): RegionStats {
  const minimum = [255, 255, 255, 255];
  const maximum = [0, 0, 0, 0];
  let hash = FNV_OFFSET_BASIS;
  for (let row = rect.y; row < rect.y + rect.height; row += 1) {
    const rowStart = (row * bufferWidth + rect.x) * BYTES_PER_RGBA_TEXEL;
    const rowEnd = rowStart + rect.width * BYTES_PER_RGBA_TEXEL;
    for (let index = rowStart; index < rowEnd; index += 1) {
      const value = rgba[index] ?? 0;
      const channel = index % BYTES_PER_RGBA_TEXEL;
      if (value < (minimum[channel] ?? 255)) minimum[channel] = value;
      if (value > (maximum[channel] ?? 0)) maximum[channel] = value;
      hash = Math.imul(hash ^ value, FNV_PRIME);
    }
  }
  const empty = rect.width <= 0 || rect.height <= 0;
  let channelRange = 0;
  for (let channel = 0; channel < BYTES_PER_RGBA_TEXEL; channel += 1) {
    channelRange = Math.max(channelRange, empty ? 0 : (maximum[channel] ?? 0) - (minimum[channel] ?? 0));
  }
  return {
    transparent: empty || (maximum[3] ?? 0) === 0,
    channelRange,
    uniform: channelRange <= UNIFORM_CHANNEL_RANGE,
    fingerprint: (hash >>> 0).toString(16).padStart(8, '0'),
  };
}

/**
 * 쪽 CSS 좌표의 사각형을 백킹 픽셀 사각형으로 옮긴다. 가장자리 안티앨리어싱을 피하려고 안쪽으로 반올림하고
 * 백킹 밖은 잘라 낸다. 남는 면적이 없으면 null.
 */
export function cssRectToBackingRect(rect: PixelRect, cssSize: Size, backing: Size): PixelRect | null {
  const scaleX = backing.width / cssSize.width;
  const scaleY = backing.height / cssSize.height;
  const left = clamp(Math.ceil(rect.x * scaleX), 0, backing.width);
  const top = clamp(Math.ceil(rect.y * scaleY), 0, backing.height);
  const right = clamp(Math.floor((rect.x + rect.width) * scaleX), 0, backing.width);
  const bottom = clamp(Math.floor((rect.y + rect.height) * scaleY), 0, backing.height);
  if (right <= left || bottom <= top) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** 사각형 여럿을 모두 덮는 가장 작은 사각형. 없으면 null. */
export function boundingRect(rects: readonly PixelRect[]): PixelRect | null {
  const first = rects[0];
  if (!first) return null;
  let left = first.x;
  let top = first.y;
  let right = first.x + first.width;
  let bottom = first.y + first.height;
  for (const rect of rects) {
    left = Math.min(left, rect.x);
    top = Math.min(top, rect.y);
    right = Math.max(right, rect.x + rect.width);
    bottom = Math.max(bottom, rect.y + rect.height);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function translateRect(rect: PixelRect, by: Point): PixelRect {
  return { x: rect.x + by.x, y: rect.y + by.y, width: rect.width, height: rect.height };
}

const DEVICE_PIXEL_TOLERANCE = 1e-3;

export type DevicePixelPlacement = { x: number; y: number; integral: boolean };

/** CSS 위치(뷰포트 기준)를 기기 px로 옮긴다. 정수 기기 px에 놓여야 화면 합성 때 다시 샘플링되지 않는다. */
export function devicePixelPlacement(cssPosition: Point, devicePixelRatio: number): DevicePixelPlacement {
  const integral =
    devicePixelError(cssPosition.x, devicePixelRatio) < DEVICE_PIXEL_TOLERANCE &&
    devicePixelError(cssPosition.y, devicePixelRatio) < DEVICE_PIXEL_TOLERANCE;
  return { x: cssPosition.x * devicePixelRatio, y: cssPosition.y * devicePixelRatio, integral };
}

export function isIntegralDevicePixel(cssPosition: number, devicePixelRatio: number): boolean {
  return devicePixelError(cssPosition, devicePixelRatio) < DEVICE_PIXEL_TOLERANCE;
}

/**
 * 기기 픽셀 경계로 옮길 CSS 이동량 후보를 가까운 순으로 낸다. 머리·설명 글의 줄 높이 때문에 캔버스가
 * 소수 기기 px에 놓이면 브라우저가 화면에서 다시 샘플링해 텍셀:픽셀 1:1이 깨진다.
 * 후보가 여럿인 이유: 배치 좌표는 엔진 단위(Chromium·WebKit 1/64 CSS px)로 반올림되므로 DPR 2.625에서는
 * 정확한 정수 기기 px가 8 CSS px마다만 있다. 호출한 쪽이 후보를 적용해 보고 실제 위치를 다시 읽어 고른다.
 */
export function devicePixelSnapCandidates(
  cssPosition: number,
  devicePixelRatio: number,
  maxShiftCss: number
): number[] {
  const device = cssPosition * devicePixelRatio;
  const nearest = Math.round(device);
  const candidates: number[] = [];
  const maxSteps = Math.ceil(maxShiftCss * devicePixelRatio) + 1;
  for (let step = 0; step <= maxSteps; step += 1) {
    for (const target of step === 0 ? [nearest] : [nearest + step, nearest - step]) {
      const offset = (target - device) / devicePixelRatio;
      if (Math.abs(offset) <= maxShiftCss) candidates.push(offset);
    }
  }
  return candidates.toSorted((left, right) => Math.abs(left) - Math.abs(right));
}

/** 기기 px 위치가 정수에서 얼마나 떨어졌는가(0–0.5). */
export function devicePixelError(cssPosition: number, devicePixelRatio: number): number {
  const device = cssPosition * devicePixelRatio;
  return Math.abs(device - Math.round(device));
}

export type PixelComparison = {
  compared: number;
  mismatched: number;
  mismatchedBeyondOne: number;
  maxChannelDelta: number;
};

/**
 * 위에서 아래로 쌓인 RGBA(2D getImageData)와 아래에서 위로 쌓인 RGBA(gl.readPixels)를
 * 같은 화면 좌표끼리 RGB만 비교한다. 알파는 WebGL 캔버스가 불투명이라 뺀다.
 */
export function compareTopDownWithBottomUp(
  topDown: ArrayLike<number>,
  bottomUp: ArrayLike<number>,
  size: Size
): PixelComparison {
  const rowLength = size.width * BYTES_PER_RGBA_TEXEL;
  let mismatched = 0;
  let mismatchedBeyondOne = 0;
  let maxChannelDelta = 0;
  for (let row = 0; row < size.height; row += 1) {
    const topRowStart = row * rowLength;
    const bottomRowStart = (size.height - 1 - row) * rowLength;
    for (let column = 0; column < rowLength; column += BYTES_PER_RGBA_TEXEL) {
      let pixelDelta = 0;
      for (let channel = 0; channel < 3; channel += 1) {
        const delta = Math.abs(
          (topDown[topRowStart + column + channel] ?? 0) - (bottomUp[bottomRowStart + column + channel] ?? 0)
        );
        if (delta > pixelDelta) pixelDelta = delta;
      }
      if (pixelDelta > 0) mismatched += 1;
      if (pixelDelta > 1) mismatchedBeyondOne += 1;
      if (pixelDelta > maxChannelDelta) maxChannelDelta = pixelDelta;
    }
  }
  return { compared: size.width * size.height, mismatched, mismatchedBeyondOne, maxChannelDelta };
}

export type DurationSummary = { count: number; last: number; median: number; min: number; max: number };

export function summarizeDurations(values: readonly number[]): DurationSummary | null {
  const last = values.at(-1);
  if (last === undefined) return null;
  const sorted = values.toSorted((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? last;
  const lower = sorted[middle - 1] ?? upper;
  return {
    count: values.length,
    last,
    median: sorted.length % 2 === 0 ? (lower + upper) / 2 : upper,
    min: sorted[0] ?? last,
    max: sorted.at(-1) ?? last,
  };
}

/** MDN devicePixelRatio 문서의 패턴. 현재 DPR과 다른 값이 되면 change가 온다. */
export function resolutionQuery(devicePixelRatio: number): string {
  return `(resolution: ${devicePixelRatio}dppx)`;
}

/** 돋보기로 잘라 낼 원본 사각형. 원본 밖으로 나가지 않게 가둔다. */
export function magnifierSourceRect(center: Point, regionSize: number, sourceSize: Size): PixelRect {
  const width = Math.min(regionSize, sourceSize.width);
  const height = Math.min(regionSize, sourceSize.height);
  const x = clamp(Math.round(center.x - width / 2), 0, sourceSize.width - width);
  const y = clamp(Math.round(center.y - height / 2), 0, sourceSize.height - height);
  return { x, y, width, height };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
