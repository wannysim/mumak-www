import { AlbumArt } from '@/components/album-art';
import { DeviceBadge } from '@/components/device-badge';
import { ProgressBar } from '@/components/progress-bar';
import { ExplicitTag, PlayStateChip } from '@/components/track-status';
import type { ThemeProps } from '@/themes/types';

/**
 * Computer 테마: 데스크톱 뮤직 플레이어 카드.
 * 가로 배치(아트 + 정보), 유리질 윈도우, 차분하고 집중된 레이아웃.
 */
export function ThemeComputer({ nowPlaying, fetchedAt }: ThemeProps) {
  return (
    <div className="flex min-h-svh items-center justify-center p-6 sm:p-10">
      <div className="flex w-full max-w-2xl flex-col items-center gap-8 rounded-3xl border border-white/10 bg-black/30 p-6 shadow-2xl backdrop-blur-2xl sm:flex-row sm:p-8">
        <AlbumArt
          src={nowPlaying.albumImageUrl}
          alt={`${nowPlaying.album} 앨범 커버`}
          className="size-44 shrink-0 rounded-2xl shadow-xl sm:size-48"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3 text-center sm:text-left">
          <PlayStateChip isPlaying={nowPlaying.isPlaying} className="justify-center sm:justify-start" />
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <h1 className="truncate text-2xl font-bold sm:text-3xl">{nowPlaying.title}</h1>
            {nowPlaying.isExplicit ? <ExplicitTag /> : null}
          </div>
          <p className="truncate text-lg opacity-80">{nowPlaying.artist}</p>
          <p className="truncate text-sm opacity-50">{nowPlaying.album}</p>
          <ProgressBar nowPlaying={nowPlaying} fetchedAt={fetchedAt} className="mt-2" />
          {nowPlaying.device ? (
            <DeviceBadge device={nowPlaying.device} className="justify-center opacity-60 sm:justify-start" />
          ) : null}
        </div>
      </div>
    </div>
  );
}
