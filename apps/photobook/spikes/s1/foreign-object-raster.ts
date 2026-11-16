// 패널 2: 시험 쪽 DOM → SVG foreignObject → Image → 2D 캔버스.
// 근거: tech-research.md 1장 foreignObject 폴백, spikes.md S1-7(단계별 시간), S1-9(Safari 첫 로드 폰트 버그).
// 1장 재래스터 규칙: Safari 첫 그리기 버그의 우회는 래스터 함수 안에서 처리한다. 그래서 내용 판정(paint-probe)과
// 다시 그리기(blank-redraw)는 raster-total에 들어가고, 하네스만 하는 늦은 비교(verifyLateDraw)는 밖에 둔다.

import { blobToDataUrl } from './font-embed';
import type { StepTimer } from './measure';
import {
  analyzeRegion,
  boundingRect,
  buildForeignObjectSvg,
  computeBackingSize,
  cssRectToBackingRect,
  svgToDataUrl,
  translateRect,
  type BackingSize,
  type PixelRect,
  type Size,
} from './raster-math';

/**
 * draw-scale: SVG 고유 크기 = CSS 크기, drawImage가 배율만큼 키운다(html-to-image·modern-screenshot 방식).
 * viewbox-scale: SVG 고유 크기 = 백킹 크기, viewBox가 키운다. 고유 크기로 래스터하는 엔진이 있는지 보려는 변형.
 */
export type SvgSizing = 'draw-scale' | 'viewbox-scale';

type ProbeKind = 'photo' | 'text';

/** 쪽 CSS 좌표의 내용 영역. data-probe 속성이 붙은 요소에서 읽는다. */
type ProbeRegion = { name: string; kind: ProbeKind; rect: PixelRect };

type RegionProbe = {
  name: string;
  kind: ProbeKind;
  /** 백킹 px. */
  rect: PixelRect;
  uniform: boolean;
  transparent: boolean;
  channelRange: number;
  fingerprint: string;
};

type PaintProbe = {
  /** 내용 영역이 모두 투명(아무것도 안 그려짐). */
  transparent: boolean;
  /** 균일해서 글자·사진이 빠진 것으로 본 영역 이름. */
  missingRegions: string[];
  regions: RegionProbe[];
};

export type PaintCheck = {
  probedRegionCount: number;
  /** 첫 그리기에서 모든 내용 영역에 글자·사진이 있었는가. false면 WebKit 219770·39059 의심. */
  firstDrawComplete: boolean;
  transparentOnFirstDraw: boolean;
  missingOnFirstDraw: string[];
  redrawn: boolean;
  /** 다시 그린 뒤에도 빠진 영역. 다시 그리지 않았으면 null. */
  missingAfterRedraw: string[] | null;
};

export type RasterRequest = {
  pageElement: HTMLElement;
  cssSize: Size;
  scale: number;
  sizing: SvgSizing;
  pageCss: string;
  fontFaceRule: string;
  photoUrl: string;
  rasterId: number;
  timer: StepTimer;
  log: (message: string) => void;
};

export type RasterOutput = {
  canvas: HTMLCanvasElement;
  backing: BackingSize;
  scale: number;
  sizing: SvgSizing;
  cssSize: Size;
  svgCharacters: number;
  svgUrlCharacters: number;
  photoBytes: number;
  paint: PaintCheck;
  /** 늦은 비교에서 다시 그릴 원본. */
  image: HTMLImageElement;
  /** 마지막으로 이 캔버스에 반영된 판정(늦은 비교의 기준). */
  finalProbe: PaintProbe;
  probeRegions: ProbeRegion[];
};

export async function rasterizeTestPage(request: RasterRequest): Promise<RasterOutput> {
  const { timer } = request;
  const probeRegions = collectProbeRegions(request.pageElement);
  const photo = await timer.time('photo-inline', () => fetchAsDataUrl(request.photoUrl));
  const svg = timer.timeSync('serialize', () => serializeToSvg(request, photo.dataUrl));
  const svgUrl = timer.timeSync('svg-encode', () => svgToDataUrl(svg));

  const image = new Image();
  await timer.time('decode', () => loadAndDecode(image, svgUrl, request.log));

  const backing = computeBackingSize(request.cssSize, request.scale);
  const canvas = document.createElement('canvas');
  canvas.width = backing.width;
  canvas.height = backing.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D 캔버스 컨텍스트를 만들 수 없다');

  timer.timeSync('draw-image', () => drawSvgImage(context, image, backing));
  timer.timeSync('draw-flush', () => flushByReadingOnePixel(context));
  const firstDraw = timer.timeSync('paint-probe', () => probePaint(canvas, probeRegions, request.cssSize, backing));

  let afterRedraw: PaintProbe | null = null;
  if (!isComplete(firstDraw)) {
    request.log(
      `첫 drawImage에서 내용이 빠졌다(${describeMissing(firstDraw)}). WebKit 219770·39059 의심. 한 프레임 뒤 한 번 다시 그린다.`
    );
    afterRedraw = await timer.time('blank-redraw', async () => {
      await nextAnimationFrame();
      drawSvgImage(context, image, backing);
      return probePaint(canvas, probeRegions, request.cssSize, backing);
    });
    request.log(
      isComplete(afterRedraw)
        ? '다시 그린 뒤 채워졌다.'
        : `다시 그린 뒤에도 빠져 있다(${describeMissing(afterRedraw)}).`
    );
  }

  return {
    canvas,
    backing,
    scale: request.scale,
    sizing: request.sizing,
    cssSize: { ...request.cssSize },
    svgCharacters: svg.length,
    svgUrlCharacters: svgUrl.length,
    photoBytes: photo.bytes,
    paint: {
      probedRegionCount: firstDraw.regions.length,
      firstDrawComplete: isComplete(firstDraw),
      transparentOnFirstDraw: firstDraw.transparent,
      missingOnFirstDraw: firstDraw.missingRegions,
      redrawn: afterRedraw !== null,
      missingAfterRedraw: afterRedraw ? afterRedraw.missingRegions : null,
    },
    image,
    finalProbe: afterRedraw ?? firstDraw,
    probeRegions,
  };
}

export type LateDrawCheck = {
  delayMs: number;
  /** 늦게 다시 그린 결과가 반영된 결과와 다른가. 다르면 첫 그리기가 서체·사진 준비 전이었다(219770 증상). */
  differs: boolean;
  differingRegions: string[];
  missingRegions: string[];
  /** differs일 때 늦은 결과를 반영된 캔버스에 덮어썼는가. */
  replaced: boolean;
};

/**
 * 반영한 뒤 delayMs가 지나 같은 SVG 이미지를 새 캔버스에 다시 그려 내용 영역의 지문을 비교한다.
 * WebKit 219770은 서체가 준비되기 전에 onload가 온다는 버그라서, 첫 그리기가 대체 서체로 나와도 알파·균일 판정은 통과한다.
 * 달라졌으면 늦은 결과를 원래 캔버스에 복사해 둔다(텍스처 재업로드는 호출한 쪽이 한다).
 */
export function verifyLateDraw(output: RasterOutput, delayMs: number): LateDrawCheck {
  const verification = document.createElement('canvas');
  verification.width = output.backing.width;
  verification.height = output.backing.height;
  const context = verification.getContext('2d');
  if (!context) throw new Error('2D 캔버스 컨텍스트를 만들 수 없다');
  try {
    drawSvgImage(context, output.image, output.backing);
    const later = probePaint(verification, output.probeRegions, output.cssSize, output.backing);
    const earlierByName = new Map(output.finalProbe.regions.map(region => [region.name, region.fingerprint]));
    const differingRegions = later.regions
      .filter(region => earlierByName.get(region.name) !== region.fingerprint)
      .map(region => region.name);
    const differs = differingRegions.length > 0;
    if (differs) {
      const target = output.canvas.getContext('2d');
      if (target) {
        target.clearRect(0, 0, output.backing.width, output.backing.height);
        target.drawImage(verification, 0, 0);
        output.finalProbe = later;
      }
    }
    return {
      delayMs,
      differs,
      differingRegions,
      missingRegions: later.missingRegions,
      replaced: differs,
    };
  } finally {
    releaseCanvas(verification);
  }
}

/** 2D 캔버스 메모리를 바로 돌려준다(spikes.md 하드 상한 기록의 iOS 우회). */
export function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 1;
  canvas.height = 1;
}

/** 시험 쪽에서 data-probe가 붙은 요소의 위치를 쪽 CSS 좌표로 읽는다. 변환(스냅 이동)은 쪽과 같이 움직여 상쇄된다. */
function collectProbeRegions(pageElement: HTMLElement): ProbeRegion[] {
  const pageRect = pageElement.getBoundingClientRect();
  return [...pageElement.querySelectorAll<HTMLElement>('[data-probe]')].map(element => {
    const rect = element.getBoundingClientRect();
    const name = element.dataset.probe ?? element.tagName.toLowerCase();
    return {
      name,
      kind: element instanceof HTMLImageElement ? 'photo' : 'text',
      rect: { x: rect.left - pageRect.left, y: rect.top - pageRect.top, width: rect.width, height: rect.height },
    };
  });
}

function serializeToSvg(request: RasterRequest, photoDataUrl: string): string {
  // 브라우징 컨텍스트가 없는 문서로 복제하면 img가 data URL을 다시 불러오지 않는다.
  const inertDocument = document.implementation.createHTMLDocument('');
  const clone = inertDocument.importNode(request.pageElement, true);
  for (const image of clone.querySelectorAll('img')) image.setAttribute('src', photoDataUrl);
  const bodyMarkup = new XMLSerializer().serializeToString(clone);
  return buildForeignObjectSvg({
    cssSize: request.cssSize,
    intrinsicScale: request.sizing === 'viewbox-scale' ? request.scale : 1,
    styleText: `${request.fontFaceRule}\n${request.pageCss}`,
    bodyMarkup,
    rasterId: request.rasterId,
  });
}

async function fetchAsDataUrl(url: string): Promise<{ dataUrl: string; bytes: number }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`사진 fetch 실패: HTTP ${response.status} ${url}`);
  const blob = await response.blob();
  return { dataUrl: await blobToDataUrl(blob), bytes: blob.size };
}

async function loadAndDecode(image: HTMLImageElement, url: string, log: (message: string) => void): Promise<void> {
  image.src = url;
  try {
    await image.decode();
  } catch (error) {
    // 일부 엔진은 SVG decode()를 거절하고도 이미지를 로드한다. 로드됐으면 계속 그리고 기록한다.
    if (image.complete && image.naturalWidth > 0) {
      log(`img.decode()가 거절됐지만 이미지는 로드됨: ${String(error)}`);
      return;
    }
    throw new Error(`SVG 이미지 decode 실패: ${String(error)}`, { cause: error });
  }
}

function drawSvgImage(context: CanvasRenderingContext2D, image: HTMLImageElement, backing: Size): void {
  context.clearRect(0, 0, backing.width, backing.height);
  context.drawImage(image, 0, 0, backing.width, backing.height);
}

/**
 * Chromium은 drawImage를 기록만 하고 SVG 래스터를 첫 읽기·업로드 때 실행한다. 1px을 읽어 그 비용을 draw-flush로 모은다.
 * 측정 캔버스를 직접 읽는 것은 이 한 번뿐이다. 나머지 읽기는 readCanvasRegion으로 사본에서 한다.
 */
function flushByReadingOnePixel(context: CanvasRenderingContext2D): void {
  try {
    context.getImageData(0, 0, 1, 1);
  } catch (error) {
    throw new Error(`캔버스를 읽을 수 없다(오염됨?): ${String(error)}`, { cause: error });
  }
}

/**
 * 원본 캔버스의 rect를 읽기 전용 사본(willReadFrequently)에 복사해 읽는다. 원본에 getImageData를 두 번 하면
 * headless Chromium 153은 "Multiple readback operations using getImageData…" 경고를 냈다. 이 경고는 그 캔버스를
 * CPU로 내리는 휴리스틱과 함께 나오는 것으로 보이며(추정), 그러면 texImage2D 측정이 CPU 업로드가 된다.
 */
export function readCanvasRegion(source: HTMLCanvasElement, rect: PixelRect): Uint8ClampedArray {
  const copy = document.createElement('canvas');
  copy.width = rect.width;
  copy.height = rect.height;
  const context = copy.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('읽기용 2D 캔버스 컨텍스트를 만들 수 없다');
  try {
    context.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
    return context.getImageData(0, 0, rect.width, rect.height).data;
  } catch (error) {
    throw new Error(`캔버스를 읽을 수 없다(오염됨?): ${String(error)}`, { cause: error });
  } finally {
    releaseCanvas(copy);
  }
}

/** 내용 영역을 모두 덮는 사각형을 한 번만 읽고, 영역마다 균일한지와 지문을 계산한다. */
function probePaint(
  source: HTMLCanvasElement,
  regions: readonly ProbeRegion[],
  cssSize: Size,
  backing: Size
): PaintProbe {
  const backingRegions = regions.flatMap(region => {
    const rect = cssRectToBackingRect(region.rect, cssSize, backing);
    return rect ? [{ ...region, rect }] : [];
  });
  const bounds = boundingRect(backingRegions.map(region => region.rect));
  if (!bounds) return { transparent: true, missingRegions: ['(내용 영역 없음)'], regions: [] };
  const pixels = readCanvasRegion(source, bounds);
  const origin = { x: -bounds.x, y: -bounds.y };
  const probed = backingRegions.map(region => {
    const stats = analyzeRegion(pixels, bounds.width, translateRect(region.rect, origin));
    return { name: region.name, kind: region.kind, rect: region.rect, ...stats };
  });
  return {
    transparent: probed.every(region => region.transparent),
    missingRegions: probed.filter(region => region.uniform).map(region => region.name),
    regions: probed,
  };
}

function isComplete(probe: PaintProbe): boolean {
  return !probe.transparent && probe.missingRegions.length === 0;
}

function describeMissing(probe: PaintProbe): string {
  if (probe.transparent) return '전부 투명';
  return `빠진 영역 ${probe.missingRegions.join(', ')}`;
}

function nextAnimationFrame(): Promise<number> {
  return new Promise(resolve => requestAnimationFrame(resolve));
}
