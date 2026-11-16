// 재래스터 트리거 관찰. 근거: tech-research.md 1장 "재래스터 규칙과 대체 경로"의 감지 방법.
// - DPR: matchMedia('(resolution: Ndppx)') change, 바뀔 때마다 새 값으로 다시 등록한다.
// - 크기: ResizeObserver devicePixelContentBoxSize(Safari·iOS 미지원), 없으면 contentBoxSize × DPR 반올림.
// - visualViewport resize: 핀치 확대는 DPR을 바꾸지 않으므로 기록만 한다.

import { computeBackingSize, resolutionQuery, type Size } from './raster-math';

export type DevicePixelSizeSource = 'device-pixel-content-box' | 'content-box×dpr';

export type RetrasterTrigger =
  | { kind: 'dpr'; previous: number; current: number }
  | { kind: 'resize'; cssSize: Size; devicePixelSize: Size; source: DevicePixelSizeSource }
  | { kind: 'visual-viewport'; scale: number; width: number; height: number };

export type RetrasterWatch = {
  observesDevicePixelContentBox: boolean;
  dispose(): void;
};

export function watchRetrasterTriggers(
  target: Element,
  onTrigger: (trigger: RetrasterTrigger) => void
): RetrasterWatch {
  let currentDpr = window.devicePixelRatio;
  let resolutionMedia: MediaQueryList | null = null;

  function onResolutionChange(): void {
    const previous = currentDpr;
    currentDpr = window.devicePixelRatio;
    listenResolution();
    onTrigger({ kind: 'dpr', previous, current: currentDpr });
  }

  function listenResolution(): void {
    resolutionMedia?.removeEventListener('change', onResolutionChange);
    resolutionMedia = window.matchMedia(resolutionQuery(currentDpr));
    resolutionMedia.addEventListener('change', onResolutionChange);
  }
  listenResolution();

  const resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) onTrigger(toResizeTrigger(entry));
  });
  let observesDevicePixelContentBox = true;
  try {
    resizeObserver.observe(target, { box: 'device-pixel-content-box' });
  } catch {
    // 이 box 값을 모르는 엔진이 예외를 던지는지는 미확인이라(1장) 감싸고 기본 box로 다시 건다.
    observesDevicePixelContentBox = false;
    resizeObserver.observe(target);
  }

  const visualViewport = window.visualViewport;
  function onVisualViewportResize(): void {
    if (!visualViewport) return;
    onTrigger({
      kind: 'visual-viewport',
      scale: visualViewport.scale,
      width: visualViewport.width,
      height: visualViewport.height,
    });
  }
  visualViewport?.addEventListener('resize', onVisualViewportResize);

  return {
    observesDevicePixelContentBox,
    dispose() {
      resolutionMedia?.removeEventListener('change', onResolutionChange);
      resizeObserver.disconnect();
      visualViewport?.removeEventListener('resize', onVisualViewportResize);
    },
  };
}

function toResizeTrigger(entry: ResizeObserverEntry): RetrasterTrigger {
  // lib.dom은 이 필드를 항상 있다고 적지만 Safari에는 없다.
  const devicePixelBoxes = entry.devicePixelContentBoxSize as ReadonlyArray<ResizeObserverSize> | undefined;
  const devicePixelBox = devicePixelBoxes?.[0];
  const contentBox = entry.contentBoxSize[0];
  // 가로쓰기라 inlineSize가 폭, blockSize가 높이다.
  const cssSize = contentBox
    ? { width: contentBox.inlineSize, height: contentBox.blockSize }
    : { width: entry.contentRect.width, height: entry.contentRect.height };
  if (devicePixelBox) {
    return {
      kind: 'resize',
      cssSize,
      devicePixelSize: { width: devicePixelBox.inlineSize, height: devicePixelBox.blockSize },
      source: 'device-pixel-content-box',
    };
  }
  const computed = computeBackingSize(cssSize, window.devicePixelRatio);
  return {
    kind: 'resize',
    cssSize,
    devicePixelSize: { width: computed.width, height: computed.height },
    source: 'content-box×dpr',
  };
}
