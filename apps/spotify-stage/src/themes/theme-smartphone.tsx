import { AlbumArt } from '@/components/album-art';
import { DeviceBadge } from '@/components/device-badge';
import { ProgressBar } from '@/components/progress-bar';
import { ExplicitTag, PlayStateChip } from '@/components/track-status';
import type { ThemeProps } from '@/themes/types';

/**
 * Smartphone 테마: 잠금화면 스타일 세로 카드.
 * 좁은 폭, 큰 앨범 아트 위주, 가운데 정렬.
 */
export function ThemeSmartphone({ nowPlaying, fetchedAt }: ThemeProps) {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-xs flex-col items-center gap-6">
        <AlbumArt
          src={nowPlaying.albumImageUrl}
          alt={`${nowPlaying.album} 앨범 커버`}
          className="aspect-square w-full rounded-3xl shadow-2xl"
        />
        <div className="flex w-full flex-col items-center gap-2 text-center">
          <PlayStateChip isPlaying={nowPlaying.isPlaying} />
          <div className="flex w-full items-center justify-center gap-2">
            <h1 className="truncate text-2xl font-bold">{nowPlaying.title}</h1>
            {nowPlaying.isExplicit ? <ExplicitTag /> : null}
          </div>
          <p className="truncate text-base opacity-80">{nowPlaying.artist}</p>
        </div>
        <ProgressBar nowPlaying={nowPlaying} fetchedAt={fetchedAt} className="w-full" />
        {nowPlaying.device ? <DeviceBadge device={nowPlaying.device} className="opacity-60" /> : null}
      </div>
    </div>
  );
}
