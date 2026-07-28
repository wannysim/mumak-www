import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';

import { Button } from '@mumak/ui/components/button';

import { AboutDrawer } from '@/components/about-drawer';
import { DisplayToggle } from '@/components/display-toggle';
import { LyricsView } from '@/components/lyrics-view';
import { PlayerControls } from '@/components/player-controls';
import { SongDrawer } from '@/components/song-drawer';
import { SyncEditor } from '@/components/sync-editor';
import { ThemeToggle } from '@/components/theme-toggle';
import { useLocalStorageState } from '@/hooks/use-local-storage-state';
import { useLyrics } from '@/hooks/use-lyrics';
import { useYouTubePlayer } from '@/hooks/use-youtube-player';
import { DEFAULT_DISPLAY } from '@/lib/display-settings';
import { DEFAULT_PLAYBACK_MODE } from '@/lib/playback-mode';
import { defaultSong, songAt, songs } from '@/songs';

export default function App() {
  const [display, setDisplay] = useLocalStorageState('karaoke:display', DEFAULT_DISPLAY);
  const [songSlug, setSongSlug] = useLocalStorageState('karaoke:song', defaultSong.slug);
  const [playbackMode, setPlaybackMode] = useLocalStorageState('karaoke:playback', DEFAULT_PLAYBACK_MODE);
  const song = songs.find(candidate => candidate.slug === songSlug) ?? defaultSong;
  const lyrics = useLyrics(song.slug);
  const [aboutOpen, setAboutOpen] = React.useState(false);

  // 곡이 끝났을 때의 처리. seekTo는 플레이어 훅이 돌려주므로 ref로 건네받는다.
  // 다음 곡 전환은 loadVideoById가 곧바로 재생까지 이어 준다.
  const seekRef = React.useRef<(seconds: number) => void>(() => {});
  const handleEnded = React.useCallback(() => {
    if (playbackMode === 'one') seekRef.current(0);
    else if (playbackMode === 'all') setSongSlug(songAt(song, 1).slug);
  }, [playbackMode, song, setSongSlug]);

  const { containerRef, time, duration, isPlaying, seekTo, togglePlay } = useYouTubePlayer(song.videoId, handleEnded);
  React.useEffect(() => {
    seekRef.current = seekTo;
  }, [seekTo]);

  const step = (offset: number) => setSongSlug(songAt(song, offset).slug);

  return (
    <div className="mx-auto flex h-svh max-w-2xl flex-col pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <header className="flex shrink-0 items-center gap-1 px-1 pt-[env(safe-area-inset-top)]">
        <Button variant="ghost" size="icon" aria-label="이전 곡" onClick={() => step(-1)} className="size-12">
          <ChevronLeft className="size-6" />
        </Button>
        <SongDrawer
          songs={songs}
          current={song}
          onSelect={next => setSongSlug(next.slug)}
          onAbout={() => setAboutOpen(true)}
        />
        <Button variant="ghost" size="icon" aria-label="다음 곡" onClick={() => step(1)} className="size-12">
          <ChevronRight className="size-6" />
        </Button>
      </header>

      {/*
        플레이어 위에는 아무것도 덮지 않는다. YouTube의 Required Minimum Functionality가
        "플레이어 앞에 오버레이·프레임 등 시각 요소를 두지 말 것"과 최소 200x200 뷰포트를 요구한다.
        재생/탐색은 아래 PlayerControls가, 컨트롤 바 숨김은 공식 파라미터(controls=0)가 담당한다.
        @see https://developers.google.com/youtube/terms/required-minimum-functionality
      */}
      <div ref={containerRef} className="aspect-video w-full shrink-0 bg-black [&>*]:size-full [&_iframe]:size-full" />

      <PlayerControls
        time={time}
        duration={duration}
        isPlaying={isPlaying}
        onSeek={seekTo}
        onTogglePlay={togglePlay}
        playbackMode={playbackMode}
        onPlaybackModeChange={setPlaybackMode}
      />

      <div className="flex shrink-0 items-center justify-between gap-2 px-2 pb-1">
        <DisplayToggle value={display} onChange={setDisplay} />
        <div className="flex items-center">
          <ThemeToggle />
          <SyncEditor time={time} />
        </div>
      </div>

      <LyricsView key={song.slug} lyrics={lyrics} time={time} display={display} onSeek={seekTo} />

      <AboutDrawer open={aboutOpen} onOpenChange={setAboutOpen} />
    </div>
  );
}
