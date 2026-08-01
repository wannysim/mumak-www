import { FileUp, QrCode } from 'lucide-react';
import * as React from 'react';

import { Button } from '@mumak/ui/components/button';
import { Drawer, DrawerClose, DrawerContent, DrawerTrigger } from '@mumak/ui/components/drawer';

import { ImportSummary } from '@/components/share/import-summary';
import { QrScan } from '@/components/share/qr-scan';
import { QrStream } from '@/components/share/qr-stream';
import { isBlockedByReducedMotion, SendPanel } from '@/components/share/send-panel';
import { ShareHeader } from '@/components/share/share-header';
import { ShareMenu } from '@/components/share/share-menu';
import { LOCAL_STORAGE_KEYS } from '@/lib/client-storage';
import type { StoredLyricsEntry } from '@/lib/lyrics-import';
import { readStoredLyricsLibrary, saveStoredLyricsBatch, withLyricsLibraryWriteLock } from '@/lib/lyrics-storage';
import {
  createKaraokeShareBundle,
  MAX_SHARE_FILE_BYTES,
  parseKaraokeShareText,
  type KaraokeShareBundle,
  type ShareScopeKind,
} from '@/lib/share/bundle';
import {
  createShareFrameStream,
  DEFAULT_SHARE_PROFILE_ID,
  shareProfile,
  type ShareFrameStream,
  type ShareProfileId,
} from '@/lib/share/frames';
import { createShareImportPlan, type ShareImportPlan } from '@/lib/share/import-plan';
import { downloadShareFile, shareBundleToDevice, supportedShareFileFormat } from '@/lib/share/share-file';
import type { SongLibrary } from '@/lib/song-library';
import type { Song } from '@/songs';

type ShareView = 'home' | 'send' | 'sending' | 'receive' | 'confirm' | 'done';

const VIEW_TITLES: Record<ShareView, string> = {
  home: '기기 간 공유',
  send: '보낼 데이터',
  sending: 'QR 보내기',
  receive: 'QR 받기',
  confirm: '가져오기 확인',
  done: '가져오기 완료',
};

const VIEW_DESCRIPTIONS: Record<ShareView, string> = {
  home: '재생목록과 가사를 옮깁니다',
  send: '서버를 거치지 않는 기기 간 이동',
  sending: '받는 기기에 이 화면을 보여 주세요',
  receive: '보내는 기기의 QR을 맞춰 주세요',
  confirm: '서버를 거치지 않는 기기 간 이동',
  done: '서버를 거치지 않는 기기 간 이동',
};

/** 섬광 위험(WCAG 2.3.1)을 줄이려면 모션을 줄인 사용자에게 초당 10장짜리 기본값을 준다. */
function initialProfileId(): ShareProfileId {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'safe' : DEFAULT_SHARE_PROFILE_ID;
}

export function ShareDrawer({
  library,
  currentPlaylistId,
  currentSong,
  onImport,
}: {
  library: SongLibrary;
  currentPlaylistId: string;
  currentSong: Song;
  onImport: (nextLibrary: SongLibrary, selection: { playlistId: string; songSlug: string }) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<ShareView>('home');
  const [scope, setScope] = React.useState<ShareScopeKind>('playlist');
  const [includeLyrics, setIncludeLyrics] = React.useState(false);
  const [storedLyrics, setStoredLyrics] = React.useState<StoredLyricsEntry[]>([]);
  const [lyricsLoading, setLyricsLoading] = React.useState(false);
  const [profileId, setProfileId] = React.useState<ShareProfileId>(initialProfileId);
  const [stream, setStream] = React.useState<ShareFrameStream | null>(null);
  const [building, setBuilding] = React.useState(false);
  const [bundle, setBundle] = React.useState<KaraokeShareBundle | null>(null);
  const [plan, setPlan] = React.useState<ShareImportPlan | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [applying, setApplying] = React.useState(false);
  const [sharing, setSharing] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const shareFileFormat = React.useMemo(supportedShareFileFormat, []);

  const currentPlaylist = library.playlists.find(playlist => playlist.id === currentPlaylistId)!;
  const scopeSlugs = React.useMemo(() => {
    if (scope === 'library') return new Set(library.songs.map(song => song.slug));
    if (scope === 'playlist') return new Set(currentPlaylist.songSlugs);
    return new Set([currentSong.slug]);
  }, [currentPlaylist.songSlugs, currentSong.slug, library.songs, scope]);

  React.useEffect(() => {
    if (open) return;
    setView('home');
    setScope('playlist');
    setIncludeLyrics(false);
    setProfileId(initialProfileId());
    setStream(null);
    setBundle(null);
    setPlan(null);
    setMessage(null);
    setBuilding(false);
    setApplying(false);
    setSharing(false);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    setLyricsLoading(true);
    void readStoredLyricsLibrary()
      .then(result => setStoredLyrics(result.entries))
      .catch(() => setStoredLyrics([]))
      .finally(() => setLyricsLoading(false));
  }, [open]);

  const makeBundle = () =>
    createKaraokeShareBundle({
      library,
      kind: scope,
      playlistId: currentPlaylistId,
      songSlug: currentSong.slug,
      lyrics: includeLyrics ? storedLyrics : undefined,
    });

  const runGuarded = async (operation: () => Promise<void> | void, fallback: string) => {
    setMessage(null);
    try {
      await operation();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : fallback);
    }
  };

  const createQr = async () => {
    setBuilding(true);
    await runGuarded(async () => {
      const nextBundle = makeBundle();
      // 라디오의 disabled를 믿지 않고 시작 직전에 다시 판정한다. 고른 뒤에 모션 줄이기를 켠
      // 사용자에게는 '비활성인데 체크된' 항목이 남아 있고, 그대로 두면 여기서 초당 60장이 시작된다.
      const selected = shareProfile(profileId);
      setStream(
        await createShareFrameStream(nextBundle, isBlockedByReducedMotion(selected) ? shareProfile('safe') : selected)
      );
      setBundle(nextBundle);
      setView('sending');
    }, 'QR을 만들지 못했습니다.');
    setBuilding(false);
  };

  const shareToDevice = async () => {
    if (!shareFileFormat || sharing) return;
    setSharing(true);
    setMessage(null);
    try {
      await shareBundleToDevice(makeBundle(), shareFileFormat);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setMessage(
          error instanceof DOMException && error.name === 'NotAllowedError'
            ? '브라우저가 이 파일 공유를 허용하지 않습니다. 공유 파일 저장을 이용해 주세요.'
            : error instanceof Error
              ? error.message
              : '기기로 공유하지 못했습니다.'
        );
      }
    } finally {
      setSharing(false);
    }
  };

  const showImportConfirmation = React.useCallback(
    (nextBundle: KaraokeShareBundle) => {
      // 적용할 수 없는 번들은 확인 화면에 들어가기 전에 여기서 던져 받는 화면에 이유를 남긴다.
      // 결과를 그대로 들고 간다. 렌더에서 다시 만들면 전체 보관함을 두 번 짓고, 그때의 에러 분기는
      // 여기를 통과한 뒤라 절대 실행되지 않는 죽은 UI가 된다.
      setPlan(createShareImportPlan(library, nextBundle, currentPlaylistId));
      setBundle(nextBundle);
      setView('confirm');
      setMessage(null);
    },
    [currentPlaylistId, library]
  );

  const readShareFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void runGuarded(async () => {
      if (file.size > MAX_SHARE_FILE_BYTES) throw new Error('공유 파일은 24MB까지 불러올 수 있습니다.');
      showImportConfirmation(parseKaraokeShareText(await file.text()));
    }, '공유 파일을 읽지 못했습니다.');
  };

  const nextSelection = (applied: SongLibrary, imported: KaraokeShareBundle) => {
    if (imported.scope.kind === 'song') {
      return { playlistId: currentPlaylistId, songSlug: imported.scope.song.slug };
    }
    if (imported.scope.kind === 'playlist') {
      return { playlistId: imported.scope.playlist.id, songSlug: imported.scope.playlist.songSlugs[0]! };
    }
    const playlist =
      applied.playlists.find(candidate => candidate.id === currentPlaylistId && candidate.songSlugs.length) ??
      applied.playlists.find(candidate => candidate.songSlugs.length)!;
    return {
      playlistId: playlist.id,
      songSlug: playlist.songSlugs.includes(currentSong.slug) ? currentSong.slug : playlist.songSlugs[0]!,
    };
  };

  const applyImport = async () => {
    if (!bundle || !plan) return;
    const applied = plan.library;
    const imported = bundle;
    setApplying(true);
    await runGuarded(async () => {
      await withLyricsLibraryWriteLock(async () => {
        let previousLibrary: string | null;
        try {
          previousLibrary = localStorage.getItem(LOCAL_STORAGE_KEYS.songLibrary);
          localStorage.setItem(LOCAL_STORAGE_KEYS.songLibrary, JSON.stringify(applied));
        } catch (error) {
          throw new Error('곡 보관함을 저장할 공간이나 권한이 부족합니다.', { cause: error });
        }
        try {
          if (imported.lyrics?.length) await saveStoredLyricsBatch(imported.lyrics);
        } catch (error) {
          try {
            if (previousLibrary === null) localStorage.removeItem(LOCAL_STORAGE_KEYS.songLibrary);
            else localStorage.setItem(LOCAL_STORAGE_KEYS.songLibrary, previousLibrary);
          } catch (rollbackError) {
            throw new Error('가사 저장에 실패했고 기존 곡 보관함도 복구하지 못했습니다.', { cause: rollbackError });
          }
          throw error;
        }
      });
      onImport(applied, nextSelection(applied, imported));
      setView('done');
    }, '공유 데이터를 저장하지 못했습니다.');
    setApplying(false);
  };

  const back = () => {
    setMessage(null);
    if (view === 'sending') {
      setStream(null);
      setView('send');
      return;
    }
    if (view === 'send' || view === 'receive') {
      setView('home');
      return;
    }
    setBundle(null);
    setPlan(null);
    setView('receive');
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="QR로 보내고 받기"
          className="text-muted-foreground hover:text-foreground size-11 rounded-none hover:bg-transparent"
        >
          <QrCode className="size-3.5 stroke-[1.5]" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="karaoke-sheet md:data-[vaul-drawer-direction=bottom]:inset-x-[calc((100%-32rem)/2)] md:border-x overflow-hidden">
        {/* 초당 갱신되는 숫자는 읽어 주지 않는다. 화면 전환 같은 굵은 이정표만 알린다. */}
        <p className="sr-only" aria-live="polite">
          {view === 'confirm' ? 'QR 수신이 끝났습니다. 가져올 내용을 확인해 주세요.' : ''}
          {view === 'done' ? '공유 데이터를 이 기기에 가져왔습니다.' : ''}
        </p>
        <ShareHeader
          title={VIEW_TITLES[view]}
          description={VIEW_DESCRIPTIONS[view]}
          onBack={view === 'home' || view === 'done' ? undefined : back}
        />

        <div className="min-h-0 flex-1 overflow-y-auto">
          {view === 'home' && <ShareMenu onSend={() => setView('send')} onReceive={() => setView('receive')} />}

          {view === 'send' && (
            <SendPanel
              library={library}
              currentPlaylist={currentPlaylist}
              currentSong={currentSong}
              scope={scope}
              onScopeChange={setScope}
              includeLyrics={includeLyrics}
              onIncludeLyricsChange={setIncludeLyrics}
              lyricsLoading={lyricsLoading}
              includedLyricsCount={storedLyrics.filter(entry => scopeSlugs.has(entry.slug)).length}
              profileId={profileId}
              onProfileChange={setProfileId}
              building={building}
              sharing={sharing}
              canShareToDevice={shareFileFormat !== null}
              onCreateQr={() => void createQr()}
              onShareToDevice={() => void shareToDevice()}
              onSaveFile={() =>
                void runGuarded(() => downloadShareFile(makeBundle()), '공유 파일을 만들지 못했습니다.')
              }
            />
          )}

          {view === 'sending' && stream && <QrStream stream={stream} />}

          {view === 'receive' && (
            <div className="flex min-h-full flex-col">
              <QrScan active onComplete={showImportConfirmation} onError={setMessage} />
              <div className="border-border border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,text/plain,.json,.txt"
                  className="sr-only"
                  aria-label="공유 파일 선택"
                  onChange={readShareFile}
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 w-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileUp />
                  카메라 대신 공유 파일 불러오기
                </Button>
              </div>
            </div>
          )}

          {view === 'confirm' && plan && (
            <ImportSummary plan={plan} applying={applying} onApply={() => void applyImport()} />
          )}

          {view === 'done' && (
            <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
              <QrCode className="size-8 stroke-[1.25]" />
              <div>
                <p className="font-medium">이 기기에 가져왔습니다</p>
                <p className="text-muted-foreground mt-1 text-xs">공유 창을 닫으면 가져온 곡으로 이동합니다.</p>
              </div>
              <DrawerClose asChild>
                <Button type="button" className="min-h-11 min-w-32 rounded-none">
                  완료
                </Button>
              </DrawerClose>
            </div>
          )}
        </div>

        {message && (
          <p role="alert" className="border-border text-destructive shrink-0 border-t px-4 py-3 text-xs">
            {message}
          </p>
        )}
      </DrawerContent>
    </Drawer>
  );
}
