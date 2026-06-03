import { cn } from '@mumak/ui/lib/utils';

import { formatTime } from '../lib/format-time';

interface SpotifyProgressBarProps {
  progressMs: number;
  durationMs: number;
  isPlaying: boolean;
  className?: string;
}

export function SpotifyProgressBar({ progressMs, durationMs, isPlaying, className }: SpotifyProgressBarProps) {
  const ratio = durationMs > 0 ? Math.min(1, Math.max(0, progressMs / durationMs)) : 0;
  const percent = ratio * 100;

  return (
    <div className={cn('w-full', className)} aria-label="Track progress">
      <div
        className="relative h-1 w-full rounded-full bg-neutral-200/60 dark:bg-neutral-700/50 overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(progressMs / 1000)}
        aria-valuemin={0}
        aria-valuemax={Math.round(durationMs / 1000)}
      >
        <div
          className={cn(
            'h-full rounded-full bg-[#1DB954] transition-[width] duration-1000 ease-linear',
            !isPlaying && 'opacity-60'
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>{formatTime(progressMs)}</span>
        <span>{formatTime(durationMs)}</span>
      </div>
    </div>
  );
}
