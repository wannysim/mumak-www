import { AlbumArt } from '@/components/album-art';
import { DeviceBadge } from '@/components/device-badge';
import { ProgressBar } from '@/components/progress-bar';
import { ExplicitTag, PlayStateChip } from '@/components/track-status';
import type { ThemeProps } from '@/themes/types';

/**
 * TV 테마: 시네마틱 풀스크린.
 * 위아래 레터박스 바, 좌측 큰 포스터, 우측 대형 타이포.
 */
export function ThemeTV({ nowPlaying, fetchedAt }: ThemeProps) {
  return (
    <div className="flex min-h-svh flex-col">
      <div className="h-[8vh] shrink-0 bg-black" aria-hidden="true" />
      <div className="flex flex-1 items-center justify-center px-[6vw]">
        <div className="flex w-full max-w-6xl items-center gap-[5vw]">
          <AlbumArt
            src={nowPlaying.albumImageUrl}
            alt={`${nowPlaying.album} 앨범 커버`}
            className="aspect-square w-[28vw] max-w-sm shrink-0 rounded-xl shadow-[0_0_80px_-10px_var(--stage-accent)]"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-5">
            <PlayStateChip isPlaying={nowPlaying.isPlaying} className="text-sm" />
            <div className="flex min-w-0 items-center gap-4">
              <h1 className="truncate text-5xl font-bold tracking-tight lg:text-7xl">{nowPlaying.title}</h1>
              {nowPlaying.isExplicit ? <ExplicitTag className="size-7 text-base" /> : null}
            </div>
            <p className="truncate text-2xl opacity-80 lg:text-3xl">{nowPlaying.artist}</p>
            <p className="truncate text-lg opacity-50">{nowPlaying.album}</p>
            <ProgressBar nowPlaying={nowPlaying} fetchedAt={fetchedAt} className="mt-3 max-w-2xl" />
            {nowPlaying.device ? <DeviceBadge device={nowPlaying.device} className="text-base opacity-70" /> : null}
          </div>
        </div>
      </div>
      <div className="h-[8vh] shrink-0 bg-black" aria-hidden="true" />
    </div>
  );
}
