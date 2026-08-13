import { configure } from '@testing-library/react';

import '@testing-library/jest-dom';

// QR 풀 사전 인코딩처럼 실제 계산을 기다리는 waitFor가 있다. 기본 1초는 부하가 걸린 CI 러너에서
// 모자라 use-share-frame-stream 테스트가 간헐적으로 터졌다. 폴링이라 통과 시엔 대기 비용이 없다.
configure({ asyncUtilTimeout: 5000 });

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  root: Element | null = null;
  rootMargin: string = '0px';
  scrollMargin: string = '0px';
  thresholds: ReadonlyArray<number> = [0];

  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
} as typeof IntersectionObserver;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// jsdom에 없는 DOM API (가사 자동 스크롤, radix/vaul 내부에서 사용)
Element.prototype.scrollIntoView = () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;
