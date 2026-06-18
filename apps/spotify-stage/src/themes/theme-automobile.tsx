import { AlbumArt } from '@/components/album-art';
import { DeviceBadge } from '@/components/device-badge';
import { ProgressBar } from '@/components/progress-bar';
import { ExplicitTag, PlayStateChip } from '@/components/track-status';
import type { ThemeProps } from '@/themes/types';

/**
 * Automobile 테마: 차량 대시보드 스타일.
 * 가로로 넓고, 운전 중 한눈에 들어오도록 큰 타이포와 두꺼운 진행 막대를 쓴다.
 */
export function ThemeAutomobile({ nowPlaying, fetchedAt }: ThemeProps) {
  return (
    <div className="flex min-h-svh items-center justify-center p-6 sm:p-12">
      <div className="flex w-full max-w-4xl items-center gap-6 sm:gap-10">
        <AlbumArt
          src={nowPlaying.albumImageUrl}
          alt={`${nowPlaying.album} 앨범 커버`}
          className="size-32 shrink-0 rounded-2xl shadow-2xl sm:size-44"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <PlayStateChip isPlaying={nowPlaying.isPlaying} />
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate text-4xl font-black tracking-tight sm:text-6xl">{nowPlaying.title}</h1>
            {nowPlaying.isExplicit ? <ExplicitTag className="size-6 text-sm" /> : null}
          </div>
          <p className="truncate text-xl opacity-80 sm:text-2xl">{nowPlaying.artist}</p>
          <ProgressBar nowPlaying={nowPlaying} fetchedAt={fetchedAt} className="mt-2 [&_[role=progressbar]]:h-2" />
          {nowPlaying.device ? <DeviceBadge device={nowPlaying.device} className="text-base opacity-70" /> : null}
        </div>
      </div>
    </div>
  );
}
