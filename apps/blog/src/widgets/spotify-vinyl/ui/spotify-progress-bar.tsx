import { useTranslations } from 'next-intl';

import { cn } from '@mumak/ui/lib/utils';

import { formatTime } from '../lib/format-time';

interface SpotifyProgressBarProps {
  progressMs: number;
  durationMs: number;
  isPlaying: boolean;
  className?: string;
}

export function SpotifyProgressBar({ progressMs, durationMs, isPlaying, className }: SpotifyProgressBarProps) {
  const t = useTranslations('home');
  const hasDuration = durationMs > 0;
  const value = hasDuration ? Math.min(durationMs, Math.max(0, progressMs)) : 0;

  return (
    <div className={cn('w-full', className)}>
      {/* aria-label은 role이 없는 wrapper div가 아니라 role="progressbar"인 progress에 둔다
          (generic role 위의 aria-label은 AT가 무시한다). */}
      <progress
        aria-label={t('trackProgress')}
        className={cn(
          'block h-1 w-full appearance-none overflow-hidden rounded-full border-0 bg-neutral-200/60 dark:bg-neutral-700/50',
          '[&::-webkit-progress-bar]:bg-transparent',
          '[&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-[#1DB954] [&::-webkit-progress-value]:transition-[width] [&::-webkit-progress-value]:duration-1000 [&::-webkit-progress-value]:ease-linear',
          '[&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-[#1DB954]',
          !isPlaying && 'opacity-60'
        )}
        value={value}
        max={hasDuration ? durationMs : 1}
        aria-valuenow={Math.round(progressMs / 1000)}
        aria-valuemin={0}
        aria-valuemax={Math.round(durationMs / 1000)}
      />
      <div className="mt-1 flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
        <span>{formatTime(progressMs)}</span>
        <span>{formatTime(durationMs)}</span>
      </div>
    </div>
  );
}
