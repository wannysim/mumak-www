import { ChevronLeft, ChevronRight, Play } from 'lucide-react';

import { Button } from '@mumak/ui/components/button';
import { cn } from '@mumak/ui/lib/utils';

import { DisplayToggle } from '@/components/display-toggle';
import { LyricsView } from '@/components/lyrics-view';
import { SongDrawer } from '@/components/song-drawer';
import { SyncEditor } from '@/components/sync-editor';
import { ThemeToggle } from '@/components/theme-toggle';
import { useLocalStorageState } from '@/hooks/use-local-storage-state';
import { useLyrics } from '@/hooks/use-lyrics';
import { useYouTubePlayer } from '@/hooks/use-youtube-player';
import { DEFAULT_DISPLAY } from '@/lib/display-settings';
import { defaultSong, songAt, songs } from '@/songs';

export default function App() {
  const [display, setDisplay] = useLocalStorageState('karaoke:display', DEFAULT_DISPLAY);
  const [songSlug, setSongSlug] = useLocalStorageState('karaoke:song', defaultSong.slug);
  const song = songs.find(candidate => candidate.slug === songSlug) ?? defaultSong;
  const { containerRef, time, isPlaying, seekTo, togglePlay } = useYouTubePlayer(song.videoId);
  const lyrics = useLyrics(song.slug);

  const step = (offset: number) => setSongSlug(songAt(song, offset).slug);

  return (
    <div className="mx-auto flex h-svh max-w-2xl flex-col pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <header className="flex shrink-0 items-center gap-1 px-1 pt-[env(safe-area-inset-top)]">
        <Button variant="ghost" size="icon" aria-label="이전 곡" onClick={() => step(-1)} className="size-12">
          <ChevronLeft className="size-6" />
        </Button>
        <SongDrawer songs={songs} current={song} onSelect={next => setSongSlug(next.slug)} />
        <Button variant="ghost" size="icon" aria-label="다음 곡" onClick={() => step(1)} className="size-12">
          <ChevronRight className="size-6" />
        </Button>
      </header>

      {/* 오버레이가 iframe 탭을 모두 가로채 YouTube 앱으로 튕기는 것을 막고, 재생/일시정지를 대신한다. */}
      <div className="relative aspect-video w-full shrink-0 bg-black">
        <div ref={containerRef} className="pointer-events-none absolute inset-0 [&>*]:size-full [&_iframe]:size-full" />
        {/* 정지 상태에서는 스크림으로 YouTube 자체 UI(제목·공유·"YouTube에서 보기")를 가린다. */}
        <button
          type="button"
          aria-label={isPlaying ? '일시정지' : '재생'}
          onClick={togglePlay}
          className="group absolute inset-0"
        >
          <span
            aria-hidden
            className={cn(
              'absolute inset-0 bg-black/70 transition-opacity duration-200 ease-[var(--ease-out-strong)]',
              isPlaying ? 'opacity-0' : 'opacity-100'
            )}
          />
          <span
            aria-hidden
            className={cn(
              'absolute inset-0 flex items-center justify-center',
              'transition-[opacity,transform] duration-200 ease-[var(--ease-out-strong)]',
              'group-active:scale-95 group-active:duration-100',
              isPlaying ? 'scale-90 opacity-0' : 'scale-100 opacity-100'
            )}
          >
            <span className="bg-primary text-primary-foreground flex size-16 items-center justify-center rounded-full">
              <Play className="size-7 translate-x-0.5 fill-current" />
            </span>
          </span>
        </button>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 px-2 py-2">
        <DisplayToggle value={display} onChange={setDisplay} />
        <div className="flex items-center">
          <ThemeToggle />
          <SyncEditor time={time} />
        </div>
      </div>

      <LyricsView key={song.slug} lyrics={lyrics} time={time} display={display} onSeek={seekTo} />
    </div>
  );
}
