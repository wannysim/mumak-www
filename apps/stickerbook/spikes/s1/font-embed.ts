// 서체 한 파일을 한 번 받아 DOM용 FontFace와 SVG용 data URL @font-face를 같은 바이트로 만든다.
// 근거: tech-research.md 1장 foreignObject 폴백(폰트를 data URL로 임베드, embedFonts:false 함정 회피).

import type { StepTimer } from './measure';
import { buildFontFaceRule } from './raster-math';

// 과제 지정 경로(gh/orioncactus/pretendard@v1.3.9/dist/web/variable/woff2/...)는 2026-11-13 확인 시 404였다.
// 그 태그에서는 파일이 packages/pretendard/dist/... 아래로 옮겨져 있어서다(jsDelivr 응답 본문 "Couldn't find the requested file").
// 같은 출처(GitHub 태그 v1.3.9)의 옮겨진 경로를 쓴다. npm pretendard@1.3.9의 같은 파일과 SHA-256이 같다(9599f12f…, 2,057,688B).
// ?font=<url>로 바꿀 수 있다.
export const PRETENDARD_VARIABLE_URL =
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2';

export type EmbeddedFont = {
  family: string;
  url: string;
  byteLength: number;
  dataUrlCharacters: number;
  fontFaceRule: string;
  transferSize: number | null;
  encodedBodySize: number | null;
};

export type LoadEmbeddedFontOptions = {
  url: string;
  family: string;
  weightRange: string;
  timer: StepTimer;
};

export async function loadEmbeddedFont(options: LoadEmbeddedFontOptions): Promise<EmbeddedFont> {
  const { url, family, weightRange, timer } = options;
  const buffer = await timer.time('font-fetch', async () => {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
    return response.arrayBuffer();
  });
  // Blob이 바이트를 복사하므로 FontFace에 버퍼를 넘기기 전에 만든다. 두 경로가 같은 바이트를 쓴다.
  const blob = new Blob([buffer], { type: 'font/woff2' });
  const byteLength = buffer.byteLength;

  await timer.time('font-register', async () => {
    const face = new FontFace(family, buffer, { weight: weightRange, style: 'normal', display: 'block' });
    await face.load();
    document.fonts.add(face);
  });

  const dataUrl = await timer.time('font-embed', () => blobToDataUrl(blob));
  const resourceTiming = performance
    .getEntriesByName(url, 'resource')
    .find((entry): entry is PerformanceResourceTiming => entry instanceof PerformanceResourceTiming);

  return {
    family,
    url,
    byteLength,
    dataUrlCharacters: dataUrl.length,
    fontFaceRule: buildFontFaceRule({ family, dataUrl, weightRange }),
    transferSize: resourceTiming?.transferSize ?? null,
    encodedBodySize: resourceTiming?.encodedBodySize ?? null,
  };
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('FileReader 결과가 문자열이 아니다'));
    });
    reader.addEventListener('error', () => reject(reader.error ?? new Error('FileReader 오류')));
    reader.readAsDataURL(blob);
  });
}
