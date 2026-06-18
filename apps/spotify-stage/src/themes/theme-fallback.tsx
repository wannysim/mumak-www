import { AlbumArt } from '@/components/album-art';
import { DeviceBadge } from '@/components/device-badge';
import { ProgressBar } from '@/components/progress-bar';
import { ExplicitTag, PlayStateChip } from '@/components/track-status';
import type { ThemeProps } from '@/themes/types';

/**
 * Fallback 테마: 4종(Computer/Smartphone/Automobile/TV) 외 디바이스나
 * 디바이스 정보가 없을 때 쓰는 중립 레이아웃.
 */
export function ThemeFallback({ nowPlaying, fetchedAt }: ThemeProps) {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <AlbumArt
          src={nowPlaying.albumImageUrl}
          alt={`${nowPlaying.album} 앨범 커버`}
          className="aspect-square w-64 rounded-2xl shadow-2xl"
        />
        <PlayStateChip isPlaying={nowPlaying.isPlaying} />
        <div className="flex items-center gap-2">
          <h1 className="truncate text-2xl font-bold">{nowPlaying.title}</h1>
          {nowPlaying.isExplicit ? <ExplicitTag /> : null}
        </div>
        <p className="truncate text-base opacity-80">{nowPlaying.artist}</p>
        <ProgressBar nowPlaying={nowPlaying} fetchedAt={fetchedAt} className="w-full" />
        {nowPlaying.device ? <DeviceBadge device={nowPlaying.device} className="opacity-60" /> : null}
      </div>
    </div>
  );
}
