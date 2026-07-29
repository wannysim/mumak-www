import { driver, type Driver } from 'driver.js';
import { ChevronLeft, ChevronRight, Download, Info } from 'lucide-react';
import * as React from 'react';

import { Button } from '@mumak/ui/components/button';

import { AboutDrawer } from '@/components/about-drawer';
import { DisplayToggle } from '@/components/display-toggle';
import { LyricsImportButton } from '@/components/lyrics-import-button';
import { LyricsView } from '@/components/lyrics-view';
import { PlayerControls } from '@/components/player-controls';
import { ReadingModeToggle } from '@/components/reading-mode-toggle';
import { SongDrawer } from '@/components/song-drawer';
import { SyncEditor } from '@/components/sync-editor';
import { ThemeToggle } from '@/components/theme-toggle';
import { useLocalStorageState } from '@/hooks/use-local-storage-state';
import { useLyrics } from '@/hooks/use-lyrics';
import { useYouTubePlayer } from '@/hooks/use-youtube-player';
import { DEFAULT_DISPLAY } from '@/lib/display-settings';
import { DEFAULT_PLAYBACK_MODE } from '@/lib/playback-mode';
import {
  ACTIVE_PLAYLIST_KEY,
  createDefaultSongLibrary,
  DEFAULT_PLAYLIST_ID,
  parseSongLibrary,
  resolvePlayback,
  SONG_LIBRARY_KEY,
} from '@/lib/song-library';
import { defaultSong, songAt } from '@/songs';

export const PRIVACY_CONSENT_KEY = 'karaoke:privacy-consent-v1';
export const KARAOKE_GUIDE_KEY = 'karaoke:first-guide-v1';

type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function KaraokeGuide({ replay, ready }: { replay: number; ready: boolean }) {
  const [seen] = useLocalStorageState(KARAOKE_GUIDE_KEY, false);
  const guideRef = React.useRef<Driver>(null);
  const shownRef = React.useRef(seen);
  const handledReplayRef = React.useRef(0);

  React.useEffect(() => {
    if (!ready || (shownRef.current && replay === handledReplayRef.current)) return;

    const frame = requestAnimationFrame(() => {
      if (guideRef.current?.isActive()) return;

      const guide = driver({
        animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        allowKeyboardControl: true,
        disableActiveInteraction: true,
        doneBtnText: '알겠어요',
        nextBtnText: '다음',
        prevBtnText: '이전',
        overlayClickBehavior: 'close',
        overlayOpacity: 0.72,
        onPopoverRender: popover => {
          shownRef.current = true;
          handledReplayRef.current = replay;
          localStorage.setItem(KARAOKE_GUIDE_KEY, 'true');
          popover.closeButton.setAttribute('aria-label', '가이드 닫기');
        },
        popoverClass: 'karaoke-guide',
        progressText: '{{current}} / {{total}}',
        showProgress: true,
        skipMissingElement: true,
        stagePadding: 6,
        stageRadius: 0,
        waitForElement: 1_500,
        steps: [
          {
            element: '[data-tour="lyrics-editor-trigger"]',
            popover: {
              title: '가사를 직접 만들 수 있어요',
              description: '연필 버튼에서 일본어 원문을 넣고, 노래를 들으며 각 줄의 시작 시간을 찍을 수 있습니다.',
              side: 'top',
              align: 'center',
            },
          },
          ...(document.querySelector('[data-tour="lyrics-file-import"]')
            ? [
                {
                  element: '[data-tour="lyrics-file-import"]',
                  popover: {
                    title: '파일이 이미 있다면',
                    description: '현재 곡의 JSON 파일 한 개는 여기서 바로 불러올 수 있습니다. 파일명은 상관없습니다.',
                    side: 'top' as const,
                    align: 'start' as const,
                  },
                },
              ]
            : []),
        ],
        onDestroyed: () => {
          guideRef.current = null;
        },
      });

      guideRef.current = guide;
      guide.drive();
    });

    return () => {
      cancelAnimationFrame(frame);
      if (guideRef.current?.isActive()) guideRef.current.destroy();
    };
  }, [ready, replay, seen]);

  return null;
}

function PrivacyConsent({ onAccept }: { onAccept: () => void }) {
  return (
    <main className="bg-background mx-auto flex min-h-svh max-w-[32rem] items-center px-6 py-10">
      <section aria-labelledby="privacy-consent-title" className="border-border w-full space-y-5 border-y py-6">
        <div className="space-y-2">
          <p className="font-utility text-primary text-[0.68rem] font-semibold tracking-[0.16em] uppercase">
            Before playback
          </p>
          <h1 id="privacy-consent-title" className="font-japanese text-2xl font-semibold">
            재생 전 확인
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            이 앱은 YouTube IFrame Player API로 영상을 재생합니다. YouTube·Google은 각자의 정책에 따라 접속 정보를
            처리할 수 있습니다.
          </p>
        </div>

        <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm leading-relaxed">
          <li>가사 파일과 직접 작성한 가사는 운영자 서버로 보내지 않고 이 브라우저에만 저장합니다.</li>
          <li>적법하게 이용할 수 있는 가사만 불러오고 관련 법령과 권리자가 허용하는 범위에서 사용해야 합니다.</li>
        </ul>

        <p className="text-muted-foreground text-xs leading-relaxed">
          계속하면{' '}
          <a
            href="https://www.youtube.com/t/terms"
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline underline-offset-2"
          >
            YouTube 이용약관
          </a>
          과 이 앱의 개인정보 안내에 동의하게 됩니다. 자세한 외부 정보 처리는{' '}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline underline-offset-2"
          >
            Google 개인정보처리방침
          </a>
          에서 확인할 수 있습니다.
        </p>

        <Button type="button" size="lg" className="w-full rounded-none" onClick={onAccept}>
          동의하고 시작
        </Button>
      </section>
    </main>
  );
}

export default function App() {
  const [accepted, setAccepted] = useLocalStorageState(PRIVACY_CONSENT_KEY, false);
  const [installPrompt, setInstallPrompt] = React.useState<InstallPromptEvent | null>(null);

  React.useEffect(() => {
    const saveInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const clearInstallPrompt = () => setInstallPrompt(null);

    window.addEventListener('beforeinstallprompt', saveInstallPrompt);
    window.addEventListener('appinstalled', clearInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', saveInstallPrompt);
      window.removeEventListener('appinstalled', clearInstallPrompt);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } finally {
      setInstallPrompt(null);
    }
  };

  return accepted ? (
    <KaraokeApp onInstall={installPrompt ? install : undefined} />
  ) : (
    <PrivacyConsent onAccept={() => setAccepted(true)} />
  );
}

function KaraokeApp({ onInstall }: { onInstall?: () => void }) {
  const [display, setDisplay] = useLocalStorageState('karaoke:display', DEFAULT_DISPLAY);
  const [songSlug, setSongSlug] = useLocalStorageState('karaoke:song', defaultSong.slug);
  const [activePlaylistId, setActivePlaylistId] = useLocalStorageState(ACTIVE_PLAYLIST_KEY, DEFAULT_PLAYLIST_ID);
  const [storedLibrary, setStoredLibrary] = useLocalStorageState<unknown>(SONG_LIBRARY_KEY, createDefaultSongLibrary());
  const [playbackMode, setPlaybackMode] = useLocalStorageState('karaoke:playback', DEFAULT_PLAYBACK_MODE);
  const [readingMode, setReadingMode] = useLocalStorageState('karaoke:reading-mode', true);
  const library = React.useMemo(() => parseSongLibrary(storedLibrary), [storedLibrary]);
  const playback = React.useMemo(
    () => resolvePlayback(library, activePlaylistId, songSlug),
    [activePlaylistId, library, songSlug]
  );
  const { playlist, songs: orderedSongs, song } = playback;
  const { lyrics, status: lyricsStatus, errorMessage: lyricsErrorMessage } = useLyrics(song.slug);
  const songSlugs = React.useMemo(() => library.songs.map(candidate => candidate.slug), [library.songs]);
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [guideReplay, setGuideReplay] = React.useState(0);

  React.useEffect(() => {
    if (activePlaylistId !== playlist.id) setActivePlaylistId(playlist.id);
    if (songSlug !== song.slug) setSongSlug(song.slug);
  }, [activePlaylistId, playlist.id, setActivePlaylistId, setSongSlug, song.slug, songSlug]);

  // 곡이 끝났을 때의 처리. seekTo는 플레이어 훅이 돌려주므로 ref로 건네받는다.
  // 다음 곡 전환은 loadVideoById가 곧바로 재생까지 이어 준다.
  const seekRef = React.useRef<(seconds: number) => void>(() => {});
  const handleEnded = React.useCallback(() => {
    if (playbackMode === 'one') seekRef.current(0);
    else if (playbackMode === 'all') setSongSlug(songAt(orderedSongs, song, 1).slug);
  }, [orderedSongs, playbackMode, song, setSongSlug]);

  const { containerRef, time, duration, isPlaying, seekTo, togglePlay } = useYouTubePlayer(song.videoId, handleEnded);
  React.useEffect(() => {
    seekRef.current = seekTo;
  }, [seekTo]);

  const step = (offset: number) => setSongSlug(songAt(orderedSongs, song, offset).slug);
  const replayGuide = () => {
    setAboutOpen(false);
    window.setTimeout(() => setGuideReplay(current => current + 1), 300);
  };

  return (
    <div className="karaoke-shell border-border/70 bg-background mx-auto flex h-svh max-w-[32rem] flex-col border-x-0 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] sm:border-x">
      <KaraokeGuide replay={guideReplay} ready={lyricsStatus !== 'loading'} />
      <header className="karaoke-header border-border flex shrink-0 items-center gap-1 border-b px-1 pt-[env(safe-area-inset-top)]">
        <Button
          variant="ghost"
          size="icon"
          aria-label="이전 곡"
          onClick={() => step(-1)}
          className="size-12 rounded-none hover:bg-transparent"
        >
          <ChevronLeft className="size-5 stroke-[1.5]" />
        </Button>
        <SongDrawer
          library={library}
          currentPlaylistId={playlist.id}
          current={song}
          onSelect={(playlistId, next) => {
            setActivePlaylistId(playlistId);
            setSongSlug(next.slug);
          }}
          onLibraryChange={setStoredLibrary}
        />
        <Button
          variant="ghost"
          size="icon"
          aria-label="다음 곡"
          onClick={() => step(1)}
          className="size-12 rounded-none hover:bg-transparent"
        >
          <ChevronRight className="size-5 stroke-[1.5]" />
        </Button>
      </header>

      <div className="karaoke-media">
        {/*
          플레이어 위에는 아무것도 덮지 않는다. YouTube의 Required Minimum Functionality가
          "플레이어 앞에 오버레이·프레임 등 시각 요소를 두지 말 것"과 최소 200x200 뷰포트를 요구한다.
          재생/탐색은 아래 PlayerControls가, 컨트롤 바 숨김은 공식 파라미터(controls=0)가 담당한다.
          @see https://developers.google.com/youtube/terms/required-minimum-functionality
        */}
        <div
          ref={containerRef}
          className="karaoke-player aspect-video min-h-[200px] w-full max-h-[378px] shrink-0 bg-black [&>*]:size-full [&_iframe]:size-full"
        />

        <PlayerControls
          time={time}
          duration={duration}
          isPlaying={isPlaying}
          onSeek={seekTo}
          onTogglePlay={togglePlay}
          playbackMode={playbackMode}
          onPlaybackModeChange={setPlaybackMode}
        />
      </div>

      <div className="karaoke-toolbar border-border flex min-h-14 shrink-0 items-center justify-between gap-2 border-b px-2">
        <div className="flex items-center">
          <DisplayToggle value={display} onChange={setDisplay} />
          <ReadingModeToggle enabled={readingMode} onChange={setReadingMode} />
        </div>
        <SyncEditor
          key={song.slug}
          time={time}
          duration={duration}
          isPlaying={isPlaying}
          lyrics={lyrics}
          songSlug={song.slug}
          songTitle={song.titleJa}
          onSeek={seekTo}
          onTogglePlay={togglePlay}
        />
      </div>

      <LyricsView
        key={song.slug}
        lyrics={lyrics}
        status={lyricsStatus}
        errorMessage={lyricsErrorMessage}
        time={time}
        display={display}
        readingMode={readingMode}
        emptyAction={
          <LyricsImportButton songSlugs={songSlugs} targetSongSlug={song.slug} label="이 곡의 JSON 불러오기" />
        }
        onSeek={seekTo}
      />

      <footer
        aria-label="앱 설치와 정보, 화면 설정"
        className="karaoke-footer border-border flex shrink-0 justify-center border-t pb-[env(safe-area-inset-bottom)]"
      >
        <div className="divide-border flex divide-x">
          {onInstall && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="앱 설치"
              onClick={onInstall}
              className="text-muted-foreground hover:text-foreground size-11 rounded-none hover:bg-transparent"
            >
              <Download className="size-3.5 stroke-[1.5]" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="앱 정보"
            onClick={() => setAboutOpen(true)}
            className="text-muted-foreground hover:text-foreground size-11 rounded-none hover:bg-transparent"
          >
            <Info className="size-3.5 stroke-[1.5]" />
          </Button>
          <ThemeToggle />
        </div>
      </footer>

      <AboutDrawer
        open={aboutOpen}
        onOpenChange={setAboutOpen}
        onStartGuide={replayGuide}
        onResetPlaylists={() => {
          setStoredLibrary(createDefaultSongLibrary());
          setActivePlaylistId(DEFAULT_PLAYLIST_ID);
          setSongSlug(defaultSong.slug);
        }}
        songSlugs={songSlugs}
      />
    </div>
  );
}
