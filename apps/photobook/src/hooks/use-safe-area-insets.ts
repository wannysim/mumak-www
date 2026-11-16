import { useSyncExternalStore } from 'react';

import type { EdgeInsets } from '@/model/book/spin';

/**
 * 기기 safe area(CSS `env(safe-area-inset-*)`, CSS px). 아이폰의 상태 표시줄·Dynamic Island·홈 막대처럼 시스템 UI와
 * 시스템 제스처가 있는 가장자리다(Apple HIG Layout "Guides and safe areas"). index.html이 viewport-fit=cover라 페이지가
 * 그 밑까지 깔린다. 값이 없는 환경(데스크톱, jsdom)은 0이다.
 * env()는 스크립트에서 바로 읽을 수 없어, 숨긴 측정 요소의 padding으로 계산된 값을 읽는다. 창 크기·방향이 바뀌면 다시 읽는다.
 */
const NO_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

const PROBE_STYLE = [
  'position: fixed',
  'top: 0',
  'left: 0',
  'width: 0',
  'height: 0',
  'visibility: hidden',
  'pointer-events: none',
  'padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)',
].join(';');

let probe: HTMLElement | null = null;
let cachedInsets: EdgeInsets = NO_INSETS;

function toPx(value: string): number {
  const px = Number.parseFloat(value);
  return Number.isFinite(px) && px > 0 ? px : 0;
}

function readInsets(): EdgeInsets {
  if (probe === null) {
    return cachedInsets;
  }
  const style = getComputedStyle(probe);
  const next: EdgeInsets = {
    top: toPx(style.paddingTop),
    right: toPx(style.paddingRight),
    bottom: toPx(style.paddingBottom),
    left: toPx(style.paddingLeft),
  };
  if (
    next.top !== cachedInsets.top ||
    next.right !== cachedInsets.right ||
    next.bottom !== cachedInsets.bottom ||
    next.left !== cachedInsets.left
  ) {
    cachedInsets = next;
  }
  return cachedInsets;
}

function subscribe(onChange: () => void): () => void {
  if (probe === null) {
    probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = PROBE_STYLE;
    document.body.append(probe);
  }
  window.addEventListener('resize', onChange);
  // 구독한 뒤 측정 요소가 생겼으니 한 번 다시 읽게 한다.
  onChange();
  return () => {
    window.removeEventListener('resize', onChange);
  };
}

export function useSafeAreaInsets(): EdgeInsets {
  return useSyncExternalStore(subscribe, readInsets, () => NO_INSETS);
}
