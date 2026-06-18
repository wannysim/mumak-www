import { cn } from '@mumak/ui/lib/utils';

import { useInterpolatedProgress } from '@/hooks/use-interpolated-progress';
import { formatDuration } from '@/lib/format';
import type { NowPlaying } from '@/lib/spotify/types';

/**
 * 보간된 진행률 막대 + 경과/총 시간.
 * 막대 색은 CSS 변수 --stage-accent 를 사용해 테마/팔레트에 따라 바뀐다.
 */
export function ProgressBar({
  nowPlaying,
  fetchedAt,
  className,
  showTimes = true,
}: {
  nowPlaying: NowPlaying;
  fetchedAt: number;
  className?: string;
  showTimes?: boolean;
}) {
  const progress = useInterpolatedProgress(nowPlaying, fetchedAt);
  const duration = nowPlaying.durationMs ?? 0;
  const ratio = duration > 0 ? Math.min(1, progress / duration) : 0;

  return (
    <div className={cn('flex w-full flex-col gap-1.5', className)}>
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-white/20"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={Math.round(progress)}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-linear"
          style={{ width: `${ratio * 100}%`, backgroundColor: 'var(--stage-accent)' }}
        />
      </div>
      {showTimes ? (
        <div className="flex justify-between text-xs tabular-nums opacity-70">
          <span>{formatDuration(progress)}</span>
          <span>{duration > 0 ? formatDuration(duration) : '--:--'}</span>
        </div>
      ) : null}
    </div>
  );
}
