import { act } from '@testing-library/react';
import { vi } from 'vitest';

/** prefers-reduced-motion을 바꿀 수 있는 matchMedia 대역. jsdom에는 matchMedia가 없다. */
export function stubReducedMotion(initial: boolean): { set: (value: boolean) => void } {
  let matches = initial;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    get matches() {
      return matches;
    },
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }));
  return {
    set(value: boolean) {
      matches = value;
      act(() => {
        for (const listener of listeners) {
          listener();
        }
      });
    },
  };
}

/** 창 크기를 바꾸고 resize를 보낸다. 기본값은 jsdom의 1024 × 768이다. */
export function resizeViewport(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
}

export function resetViewport(): void {
  resizeViewport(1024, 768);
}
