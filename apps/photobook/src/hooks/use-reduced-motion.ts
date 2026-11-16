import { useSyncExternalStore } from 'react';

/**
 * prefers-reduced-motion을 처음과 바뀔 때(matchMedia change) 읽는다(tech-research.md 7장 공통 규칙, WCAG C39).
 * matchMedia가 없는 환경에서는 동작 줄이기를 끈 것으로 본다.
 */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function mediaQuery(): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED_MOTION_QUERY) : null;
}

function subscribe(onChange: () => void): () => void {
  const query = mediaQuery();
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}

function readPrefersReducedMotion(): boolean {
  return mediaQuery()?.matches === true;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, readPrefersReducedMotion, readPrefersReducedMotion);
}
