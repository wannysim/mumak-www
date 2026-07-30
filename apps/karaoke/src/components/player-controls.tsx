import { Pause, Play } from 'lucide-react';
import * as React from 'react';

import { Button } from '@mumak/ui/components/button';

import { PlaybackModeToggle } from '@/components/playback-mode-toggle';
import { formatTime } from '@/lib/format-time';
import type { PlaybackMode } from '@/lib/playback-mode';

export function PlayerControls({
  time,
  duration,
  isPlaying,
  onSeek,
  onTogglePlay,
  playbackMode,
  onPlaybackModeChange,
}: {
  time: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (seconds: number) => void;
  onTogglePlay: () => void;
  playbackMode: PlaybackMode;
  onPlaybackModeChange: (mode: PlaybackMode) => void;
}) {
  // 드래그하는 동안에는 250ms 폴링으로 들어오는 재생 시간이 손가락을 되돌리지 않도록
  // 로컬 값을 보여 주고, 손을 뗀 순간에만 실제로 탐색한다.
  const [scrubbing, setScrubbing] = React.useState<number | null>(null);
  const known = duration > 0;
  const shown = Math.min(scrubbing ?? time, known ? duration : 0);

  const commit = () => {
    if (scrubbing === null) return;
    onSeek(scrubbing);
    setScrubbing(null);
  };

  return (
    <div className="karaoke-controls border-border flex min-h-11 shrink-0 items-center gap-1 border-b px-2 min-[360px]:gap-2 min-[360px]:px-3">
      <Button
        variant="ghost"
        size="icon"
        className="size-11 shrink-0 rounded-none hover:bg-transparent"
        aria-label={isPlaying ? '일시정지' : '재생'}
        onClick={onTogglePlay}
      >
        {isPlaying ? (
          <Pause className="size-6 fill-current" />
        ) : (
          <Play className="size-6 translate-x-0.5 fill-current" />
        )}
      </Button>

      <span className="karaoke-time font-utility text-muted-foreground w-8 shrink-0 text-right text-[0.625rem] tabular-nums">
        {formatTime(shown)}
      </span>

      {/* 네이티브 range는 터치 드래그·키보드·스크린리더를 전부 공짜로 얻는다. */}
      <input
        type="range"
        aria-label="재생 위치"
        className="karaoke-progress h-11 min-w-0 flex-1 cursor-pointer disabled:cursor-default disabled:opacity-40"
        min={0}
        max={known ? duration : 1}
        step={0.5}
        disabled={!known}
        value={shown}
        onChange={event => setScrubbing(Number(event.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />

      <span className="karaoke-time font-utility text-muted-foreground w-8 shrink-0 text-[0.625rem] tabular-nums">
        {known ? formatTime(duration) : '--:--'}
      </span>

      <PlaybackModeToggle mode={playbackMode} onChange={onPlaybackModeChange} />
    </div>
  );
}
