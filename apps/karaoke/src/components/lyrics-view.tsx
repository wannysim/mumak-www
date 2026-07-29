import * as React from 'react';

import { cn } from '@mumak/ui/lib/utils';

import type { DisplaySettings } from '@/lib/display-settings';
import { formatCueTime } from '@/lib/format-time';
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
  readingMode,
  onSelect,
}: {
  line: LyricLine;
  index: number;
  isActive: boolean;
  display: DisplaySettings;
  readingMode: boolean;
  onSelect: (index: number) => void;
}) {
  return (
    <li>
      <button
        type="button"
        data-line={index}
        aria-current={isActive ? 'true' : undefined}
        onClick={() => onSelect(index)}
        // press 피드백은 index.css가 모든 버튼에 공통으로 준다.
        className="lyric-row w-full rounded-none px-1 py-4 text-left"
      >
        <div
          className={cn(
            'lyric-content origin-left',
            isActive ? 'scale-100' : readingMode ? 'scale-[0.92]' : 'scale-[0.84]'
          )}
        >
          {display.jp && (
            <p
              lang="ja"
              className={cn(
                'lyric-jp font-japanese text-balance',
                isActive ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {line.jp}
            </p>
          )}

          <span
            aria-hidden="true"
            className={cn(
              'mt-2 flex items-center gap-2 transition-opacity duration-150',
              isActive ? 'opacity-100' : 'opacity-0'
            )}
          >
            <span className="bg-primary h-px min-w-0 flex-1" />
            <span className="font-utility text-primary shrink-0 text-[0.5625rem] tracking-[0.08em] tabular-nums">
              {formatCueTime(line.time)}
            </span>
          </span>

          {display.pron && line.pron && (
            <p className={cn('lyric-pron', isActive ? 'text-primary' : 'text-muted-foreground')}>{line.pron}</p>
          )}
          {display.ko && line.ko && (
            <p className={cn('lyric-ko', readingMode && isActive ? 'text-foreground' : 'text-muted-foreground')}>
              {line.ko}
            </p>
          )}
        </div>
      </button>
    </li>
  );
});

export function LyricsView({
  lyrics,
  status = 'ready',
  errorMessage,
  time,
  display,
  readingMode = false,
  emptyAction,
  onSeek,
}: {
  lyrics: LyricLine[];
  status?: 'loading' | 'ready' | 'error';
  errorMessage?: string;
  time: number;
  display: DisplaySettings;
  readingMode?: boolean;
  emptyAction?: React.ReactNode;
  onSeek: (seconds: number) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const manualScrollUntilRef = React.useRef(0);
  const activeIndex = currentLineIndex(lyrics, time);
  const focusedIndex = activeIndex >= 0 ? activeIndex : lyrics.length > 0 ? 0 : -1;

  const centerLine = React.useCallback((index: number) => {
    containerRef.current
      ?.querySelector(`[data-line="${index}"]`)
      ?.scrollIntoView({ block: 'center', behavior: scrollBehavior() });
  }, []);

  React.useEffect(() => {
    if (focusedIndex < 0 || Date.now() < manualScrollUntilRef.current) return;
    centerLine(focusedIndex);
  }, [activeIndex, focusedIndex, centerLine, readingMode, display.jp, display.pron, display.ko]);

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

  if (status === 'loading') {
    return (
      <div className="karaoke-lyrics text-muted-foreground min-h-0 flex-1 px-6 text-xs tracking-[0.14em] uppercase">
        <div className="flex min-h-full items-center py-6">내 가사 확인 중</div>
      </div>
    );
  }

  if (lyrics.length === 0) {
    return (
      <div className="karaoke-lyrics text-muted-foreground min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-6 text-left [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-h-full flex-col items-start justify-center py-6">
          <p className="mb-4 text-[0.68rem] font-semibold tracking-[0.16em] uppercase">내 가사</p>
          <p className="text-foreground text-2xl font-semibold tracking-[-0.04em]">가사를 불러오세요</p>
          <p className="mt-3 max-w-[19rem] text-sm leading-relaxed">
            {status === 'error'
              ? `저장된 가사를 읽지 못했습니다. ${errorMessage ?? '새 파일을 불러오거나 기기 저장소를 비운 뒤 다시 시도해 주세요.'}`
              : '가사 파일을 한 번 불러오면 이 기기에만 저장되고, 다음부터는 오프라인에서도 바로 열립니다.'}
          </p>
          <div className="mt-5">{emptyAction}</div>
        </div>
      </div>
    );
  }

  // 첫/마지막 줄까지 화면 중앙에 오도록 하는 여백은 스크롤 컨테이너가 아니라 안쪽 목록에 준다.
  // 컨테이너에 주면 패딩이 flex 축소 하한이 되어 남은 높이보다 커지고 문서 전체가 스크롤된다.
  return (
    <div
      ref={containerRef}
      data-reading-mode={readingMode ? 'true' : 'false'}
      onWheel={holdAutoScroll}
      onTouchMove={holdAutoScroll}
      className="karaoke-lyrics min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-5 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[480px]:px-7"
    >
      <ul className="flex flex-col gap-3 py-[30svh]">
        {lyrics.map((line, index) => (
          <LyricRow
            key={line.time}
            line={line}
            index={index}
            isActive={index === activeIndex}
            display={display}
            readingMode={readingMode}
            onSelect={selectLine}
          />
        ))}
      </ul>
    </div>
  );
}
