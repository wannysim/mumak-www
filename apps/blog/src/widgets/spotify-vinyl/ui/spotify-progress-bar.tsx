import { cn } from '@mumak/ui/lib/utils';

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
    <div className={cn('flex items-center gap-2 w-full', className)} aria-label="Track progress">
      <span className="text-[10px] tabular-nums text-muted-foreground shrink-0 w-8 text-right">
        {formatTime(progressMs)}
      </span>
      <div
        className="relative h-1 flex-1 rounded-full bg-neutral-200/60 dark:bg-neutral-700/50 overflow-hidden"
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
      <span className="text-[10px] tabular-nums text-muted-foreground shrink-0 w-8">{formatTime(durationMs)}</span>
    </div>
  );
}

export function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
