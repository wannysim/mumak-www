import * as React from 'react';

import { cn } from '@mumak/ui/lib/utils';

import type { DisplaySettings } from '@/lib/display-settings';
import { currentLineIndex, type LyricLine } from '@/lib/lyrics';

/** 손으로 스크롤한 뒤 이 시간 동안은 자동 스크롤이 화면을 뺏지 않는다. */
const MANUAL_SCROLL_HOLD_MS = 3000;

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

const LyricRow = React.memo(function LyricRow({
  line,
  index,
  isActive,
  display,
  onSelect,
}: {
  line: LyricLine;
  index: number;
  isActive: boolean;
  display: DisplaySettings;
  onSelect: (index: number) => void;
}) {
  return (
    <li>
      <button
        type="button"
        data-line={index}
        aria-current={isActive ? 'true' : undefined}
        onClick={() => onSelect(index)}
        className={cn(
          'w-full rounded-lg px-2 py-2.5 text-center',
          'transition-[opacity,transform] duration-200 ease-[var(--ease-out-strong)]',
          'active:scale-[0.98] active:duration-100',
          isActive ? 'opacity-100' : 'opacity-35 hover:opacity-70'
        )}
      >
        {display.jp && (
          <p lang="ja" className="text-xl leading-snug font-bold text-balance">
            {line.jp}
          </p>
        )}
        {display.pron && line.pron && <p className="text-primary mt-0.5 leading-snug">{line.pron}</p>}
        {display.ko && line.ko && <p className="text-muted-foreground mt-0.5 text-sm leading-snug">{line.ko}</p>}
      </button>
    </li>
  );
});

export function LyricsView({
  lyrics,
  time,
  display,
  onSeek,
}: {
  lyrics: LyricLine[];
  time: number;
  display: DisplaySettings;
  onSeek: (seconds: number) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const manualScrollUntilRef = React.useRef(0);
  const activeIndex = currentLineIndex(lyrics, time);

  const centerLine = React.useCallback((index: number) => {
    containerRef.current
      ?.querySelector(`[data-line="${index}"]`)
      ?.scrollIntoView({ block: 'center', behavior: scrollBehavior() });
  }, []);

  React.useEffect(() => {
    if (activeIndex < 0 || Date.now() < manualScrollUntilRef.current) return;
    centerLine(activeIndex);
  }, [activeIndex, centerLine]);

  // 줄을 직접 탭한 것은 명시적인 의사표시다. 직전에 손으로 스크롤했더라도
  // 자동 스크롤을 즉시 되살리고, 이미 활성인 줄을 눌렀을 때도 가운데로 보정한다.
  const selectLine = React.useCallback(
    (index: number) => {
      const line = lyrics[index];
      if (!line) return;
      manualScrollUntilRef.current = 0;
      onSeek(line.time);
      centerLine(index);
    },
    [lyrics, onSeek, centerLine]
  );

  const holdAutoScroll = () => {
    manualScrollUntilRef.current = Date.now() + MANUAL_SCROLL_HOLD_MS;
  };

  if (lyrics.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
        <p className="font-medium">아직 가사가 등록되지 않은 곡이에요.</p>
        <p className="text-sm">
          싱크 편집 모드로 가사를 만들어 public/lyrics/&lt;곡&gt;.json으로 저장하면 노래방 모드가 켜져요.
        </p>
      </div>
    );
  }

  // 첫/마지막 줄까지 화면 중앙에 오도록 하는 여백은 스크롤 컨테이너가 아니라 안쪽 목록에 준다.
  // 컨테이너에 주면 패딩이 flex 축소 하한이 되어 남은 높이보다 커지고 문서 전체가 스크롤된다.
  return (
    <div
      ref={containerRef}
      onWheel={holdAutoScroll}
      onTouchMove={holdAutoScroll}
      className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex flex-col gap-1 py-[35svh]">
        {lyrics.map((line, index) => (
          <LyricRow
            key={line.time}
            line={line}
            index={index}
            isActive={index === activeIndex}
            display={display}
            onSelect={selectLine}
          />
        ))}
      </ul>
    </div>
  );
}
