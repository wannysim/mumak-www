import { useSyncExternalStore } from 'react';

import type { Viewport } from '@/model/book/layout';

/**
 * 창 크기(CSS px)와 루트 글자 크기. innerWidth·innerHeight를 읽는다. 페이지는 스크롤하지 않으므로 스크롤 막대 폭이 끼지 않는다.
 * 루트 글자 크기는 src/index.css :root가 정본이라 계산된 값을 읽어 rem 치수 계산에 넘긴다(읽지 못하면 layout.ts 기본값).
 * 높이 기준(작은·동적·큰 뷰포트)은 임시, open-decisions G0 "책 크기와 모바일 주소창".
 */
let cachedViewport: Viewport | null = null;

function readRootFontPx(): number | undefined {
  const value = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function readViewport(): Viewport {
  const { innerWidth: width, innerHeight: height } = window;
  const rootFontPx = readRootFontPx();
  if (
    cachedViewport === null ||
    cachedViewport.width !== width ||
    cachedViewport.height !== height ||
    cachedViewport.rootFontPx !== rootFontPx
  ) {
    cachedViewport = rootFontPx === undefined ? { width, height } : { width, height, rootFontPx };
  }
  return cachedViewport;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

export function useViewportSize(): Viewport {
  return useSyncExternalStore(subscribe, readViewport, readViewport);
}
