import type { Driver } from 'driver.js';
import * as React from 'react';

import { useLocalStorageState } from '@/hooks/use-local-storage-state';
import { LOCAL_STORAGE_KEYS } from '@/lib/client-storage';

export function KaraokeGuide({ replay, ready }: { replay: number; ready: boolean }) {
  const [seen] = useLocalStorageState(LOCAL_STORAGE_KEYS.firstGuide, false);
  const guideRef = React.useRef<Driver>(null);
  const shownRef = React.useRef(seen);
  const handledReplayRef = React.useRef(0);

  React.useEffect(() => {
    if (!ready || (shownRef.current && replay === handledReplayRef.current)) return;

    let cancelled = false;
    // driver.js는 최초 온보딩 투어에서만 쓰이므로 초기 청크에서 빼 두고 이 시점에 받아온다.
    const frame = requestAnimationFrame(async () => {
      if (guideRef.current?.isActive()) return;

      const { driver } = await import('driver.js');
      if (cancelled) return;

      const guide = driver({
        animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        allowKeyboardControl: true,
        disableActiveInteraction: true,
        doneBtnText: '알겠어요',
        nextBtnText: '다음',
        prevBtnText: '이전',
        overlayClickBehavior: 'close',
        overlayOpacity: 0.72,
        onPopoverRender: popover => {
          shownRef.current = true;
          handledReplayRef.current = replay;
          localStorage.setItem(LOCAL_STORAGE_KEYS.firstGuide, 'true');
          popover.closeButton.setAttribute('aria-label', '가이드 닫기');
        },
        popoverClass: 'karaoke-guide',
        progressText: '{{current}} / {{total}}',
        showProgress: true,
        skipMissingElement: true,
        stagePadding: 6,
        stageRadius: 0,
        waitForElement: 1_500,
        steps: [
          {
            element: '[data-tour="lyrics-editor-trigger"]',
            popover: {
              title: '가사를 직접 만들 수 있어요',
              description: '연필 버튼에서 일본어 원문을 넣고, 노래를 들으며 각 줄의 시작 시간을 찍을 수 있습니다.',
              side: 'top',
              align: 'center',
            },
          },
          ...(document.querySelector('[data-tour="lyrics-file-import"]')
            ? [
                {
                  element: '[data-tour="lyrics-file-import"]',
                  popover: {
                    title: '파일이 이미 있다면',
                    description: '현재 곡의 JSON 파일 한 개는 여기서 바로 불러올 수 있습니다. 파일명은 상관없습니다.',
                    side: 'top' as const,
                    align: 'start' as const,
                  },
                },
              ]
            : []),
        ],
        onDestroyed: () => {
          guideRef.current = null;
        },
      });

      guideRef.current = guide;
      guide.drive();
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (guideRef.current?.isActive()) guideRef.current.destroy();
    };
  }, [ready, replay]);

  return null;
}
