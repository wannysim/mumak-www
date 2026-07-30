import {
  ArrowLeft,
  Camera,
  FileDown,
  FileUp,
  Library,
  ListMusic,
  QrCode,
  ScanLine,
  Send,
  Share2,
  X,
} from 'lucide-react';
import QrScanner from 'qr-scanner';
import { QRCodeSVG } from 'qrcode.react';
import * as React from 'react';

import { Button } from '@mumak/ui/components/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from '@mumak/ui/components/drawer';
import { Label } from '@mumak/ui/components/label';
import { Progress } from '@mumak/ui/components/progress';
import { RadioGroup, RadioGroupItem } from '@mumak/ui/components/radio-group';
import { Switch } from '@mumak/ui/components/switch';
import { cn } from '@mumak/ui/lib/utils';

import { LOCAL_STORAGE_KEYS } from '@/lib/client-storage';
import type { StoredLyricsEntry } from '@/lib/lyrics-import';
import { readStoredLyricsLibrary, saveStoredLyricsBatch, withLyricsLibraryWriteLock } from '@/lib/lyrics-storage';
import {
  createKaraokeShareBundle,
  createShareImportPlan,
  encodeKaraokeShareFrames,
  KaraokeShareFrameCollector,
  MAX_SHARE_FILE_BYTES,
  parseKaraokeShareText,
  serializeKaraokeShareBundle,
  type KaraokeShareBundle,
  type ShareImportPlan,
  type ShareScopeKind,
} from '@/lib/share-transfer';
import type { SongLibrary } from '@/lib/song-library';
import type { Song } from '@/songs';

type ShareView = 'home' | 'send' | 'sending' | 'receive' | 'confirm' | 'done';
type ShareFileFormat = 'json' | 'text';

function ShareHeader({ title, description, onBack }: { title: string; description: string; onBack?: () => void }) {
  const firstControlRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    const control = firstControlRef.current;
    if (control?.closest('[role="dialog"]')) control.focus();
  }, [title]);

  return (
    <header className="border-border grid min-h-16 shrink-0 grid-cols-[3rem_1fr_3rem] items-center border-b px-1">
      {onBack ? (
        <Button
          ref={firstControlRef}
          type="button"
          variant="ghost"
          size="icon"
          aria-label="이전 화면"
          onClick={onBack}
          className="size-12"
        >
          <ArrowLeft className="size-4 stroke-[1.5]" />
        </Button>
      ) : (
        <DrawerClose asChild>
          <Button
            ref={firstControlRef}
            type="button"
            variant="ghost"
            size="icon"
            aria-label="공유 닫기"
            className="size-12"
          >
            <X className="size-4 stroke-[1.5]" />
          </Button>
        </DrawerClose>
      )}
      <div className="min-w-0 text-center">
        <DrawerTitle className="truncate">{title}</DrawerTitle>
        <DrawerDescription className="truncate text-xs">{description}</DrawerDescription>
      </div>
      <span aria-hidden="true" />
    </header>
  );
}

function ScopeOption({
  value,
  title,
  description,
  icon: Icon,
}: {
  value: ShareScopeKind;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Label
      htmlFor={`share-${value}`}
      className="border-border has-data-[state=checked]:border-primary flex min-h-16 cursor-pointer items-center gap-3 border px-3 py-2"
    >
      <RadioGroupItem id={`share-${value}`} value={value} />
      <Icon className="text-muted-foreground size-4 shrink-0 stroke-[1.5]" />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="text-muted-foreground block truncate text-xs">{description}</span>
      </span>
    </Label>
  );
}

function createShareFile(content: string, format: ShareFileFormat = 'json'): File {
  const isJson = format === 'json';
  return new File([content], `karaoke-share-${new Date().toISOString().slice(0, 10)}.${isJson ? 'json' : 'txt'}`, {
    type: isJson ? 'application/json' : 'text/plain',
  });
}

// Source: https://www.w3.org/TR/web-share/#sharing-a-file
function supportedShareFileFormat(): ShareFileFormat | null {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.share !== 'function' ||
    typeof navigator.canShare !== 'function'
  ) {
    return null;
  }
  try {
    for (const format of ['json', 'text'] as const) {
      if (navigator.canShare({ files: [createShareFile('{}', format)] })) return format;
    }
  } catch {
    return null;
  }
  return null;
}

function downloadShareFile(bundle: KaraokeShareBundle) {
  const file = createShareFile(serializeKaraokeShareBundle(bundle));
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function importButtonLabel(kind: ShareScopeKind): string {
  if (kind === 'song') return '이 곡 가져오기';
  if (kind === 'playlist') return '이 재생목록 가져오기';
  return '이 기기의 보관함 교체';
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
  const [frames, setFrames] = React.useState<string[]>([]);
  const [frameIndex, setFrameIndex] = React.useState(0);
  const [building, setBuilding] = React.useState(false);
  const [cameraStarting, setCameraStarting] = React.useState(false);
  const [cameraActive, setCameraActive] = React.useState(false);
  const [receiveProgress, setReceiveProgress] = React.useState({ received: 0, total: 0 });
  const [bundle, setBundle] = React.useState<KaraokeShareBundle | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [applying, setApplying] = React.useState(false);
  const [sharing, setSharing] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const scannerRef = React.useRef<QrScanner | null>(null);
  const cameraRequestRef = React.useRef(0);
  const collectorRef = React.useRef(new KaraokeShareFrameCollector());
  const decodingRef = React.useRef(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const shareFileFormat = React.useMemo(supportedShareFileFormat, []);

  const currentPlaylist = library.playlists.find(playlist => playlist.id === currentPlaylistId)!;
  const scopeSlugs = React.useMemo(() => {
    if (scope === 'library') return new Set(library.songs.map(song => song.slug));
    if (scope === 'playlist') return new Set(currentPlaylist.songSlugs);
    return new Set([currentSong.slug]);
  }, [currentPlaylist.songSlugs, currentSong.slug, library.songs, scope]);
  const includedLyricsCount = storedLyrics.filter(entry => scopeSlugs.has(entry.slug)).length;

  const stopCamera = React.useCallback(() => {
    cameraRequestRef.current += 1;
    scannerRef.current?.destroy();
    scannerRef.current = null;
    setCameraStarting(false);
    setCameraActive(false);
  }, []);

  const resetReceive = React.useCallback(() => {
    stopCamera();
    collectorRef.current.reset();
    decodingRef.current = false;
    setReceiveProgress({ received: 0, total: 0 });
  }, [stopCamera]);

  const reset = React.useCallback(() => {
    resetReceive();
    setView('home');
    setScope('playlist');
    setIncludeLyrics(false);
    setFrames([]);
    setFrameIndex(0);
    setBundle(null);
    setMessage(null);
    setBuilding(false);
    setCameraStarting(false);
    setApplying(false);
    setSharing(false);
  }, [resetReceive]);

  React.useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  React.useEffect(() => {
    if (!open) return;
    setLyricsLoading(true);
    void readStoredLyricsLibrary()
      .then(result => setStoredLyrics(result.entries))
      .catch(() => setStoredLyrics([]))
      .finally(() => setLyricsLoading(false));
  }, [open]);

  React.useEffect(() => {
    if (view !== 'sending' || frames.length < 2) return;
    const interval = window.setInterval(() => {
      setFrameIndex(index => (index + 1) % frames.length);
    }, 500);
    return () => window.clearInterval(interval);
  }, [frames.length, view]);

  React.useEffect(() => {
    const stopWhenHidden = () => {
      if (document.hidden) stopCamera();
    };
    document.addEventListener('visibilitychange', stopWhenHidden);
    return () => {
      document.removeEventListener('visibilitychange', stopWhenHidden);
      stopCamera();
    };
  }, [stopCamera]);

  const makeBundle = React.useCallback(
    () =>
      createKaraokeShareBundle({
        library,
        kind: scope,
        playlistId: currentPlaylistId,
        songSlug: currentSong.slug,
        lyrics: includeLyrics ? storedLyrics : undefined,
      }),
    [currentPlaylistId, currentSong.slug, includeLyrics, library, scope, storedLyrics]
  );

  const createQr = async () => {
    setBuilding(true);
    setMessage(null);
    try {
      const nextBundle = makeBundle();
      const nextFrames = await encodeKaraokeShareFrames(nextBundle);
      setBundle(nextBundle);
      setFrames(nextFrames);
      setFrameIndex(0);
      setView('sending');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'QR을 만들지 못했습니다.');
    } finally {
      setBuilding(false);
    }
  };

  const saveFile = () => {
    setMessage(null);
    try {
      downloadShareFile(makeBundle());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '공유 파일을 만들지 못했습니다.');
    }
  };

  const shareToDevice = async () => {
    if (!shareFileFormat || sharing) return;
    setSharing(true);
    setMessage(null);
    try {
      const file = createShareFile(serializeKaraokeShareBundle(makeBundle()), shareFileFormat);
      if (
        typeof navigator.share !== 'function' ||
        typeof navigator.canShare !== 'function' ||
        !navigator.canShare({ files: [file] })
      ) {
        throw new Error('이 공유 파일은 기기로 바로 보낼 수 없습니다. 공유 파일 저장을 이용해 주세요.');
      }
      await navigator.share({ title: 'MUMAK Karaoke 공유', files: [file] });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setMessage(error instanceof Error ? error.message : '기기로 공유하지 못했습니다.');
      }
    } finally {
      setSharing(false);
    }
  };

  const showImportConfirmation = React.useCallback(
    (nextBundle: KaraokeShareBundle) => {
      createShareImportPlan(library, nextBundle, currentPlaylistId);
      setBundle(nextBundle);
      setView('confirm');
      setMessage(null);
    },
    [currentPlaylistId, library]
  );

  const receiveFrame = React.useCallback(
    async (value: string) => {
      if ((!value.startsWith('MK1|') && !value.startsWith('MK2:')) || decodingRef.current) return;
      try {
        const progress = collectorRef.current.add(value);
        if (!progress.accepted) return;
        setReceiveProgress({ received: progress.received, total: progress.total });
        if (!collectorRef.current.complete) return;

        decodingRef.current = true;
        stopCamera();
        const nextBundle = await collectorRef.current.decode();
        showImportConfirmation(nextBundle);
      } catch (error) {
        stopCamera();
        collectorRef.current.reset();
        decodingRef.current = false;
        setReceiveProgress({ received: 0, total: 0 });
        setMessage(error instanceof Error ? error.message : 'QR 데이터를 읽지 못했습니다.');
      }
    },
    [showImportConfirmation, stopCamera]
  );

  const startCamera = async () => {
    if (cameraStarting) return;
    const requestId = ++cameraRequestRef.current;
    setCameraStarting(true);
    setMessage(null);
    try {
      if (!videoRef.current) throw new Error('카메라 화면을 준비하지 못했습니다.');
      if (requestId !== cameraRequestRef.current) return;
      const scanner = new QrScanner(videoRef.current, result => void receiveFrame(result.data), {
        preferredCamera: 'environment',
        maxScansPerSecond: 12,
        highlightScanRegion: true,
        highlightCodeOutline: true,
        returnDetailedScanResult: true,
      });
      scannerRef.current = scanner;
      await scanner.start();
      if (requestId !== cameraRequestRef.current) {
        scanner.destroy();
        return;
      }
      setCameraActive(true);
    } catch (error) {
      stopCamera();
      const denied = error instanceof DOMException && error.name === 'NotAllowedError';
      setMessage(
        denied
          ? '카메라 권한이 필요합니다. 브라우저 설정에서 허용한 뒤 다시 시도해 주세요.'
          : error instanceof Error
            ? error.message
            : '카메라를 시작하지 못했습니다.'
      );
    } finally {
      if (requestId === cameraRequestRef.current) setCameraStarting(false);
    }
  };

  const readShareFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setMessage(null);
    try {
      if (file.size > MAX_SHARE_FILE_BYTES) throw new Error('공유 파일은 24MB까지 불러올 수 있습니다.');
      resetReceive();
      showImportConfirmation(parseKaraokeShareText(await file.text()));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '공유 파일을 읽지 못했습니다.');
    }
  };

  let plan: ShareImportPlan | null = null;
  let planError: string | null = null;
  if (bundle && view === 'confirm') {
    try {
      plan = createShareImportPlan(library, bundle, currentPlaylistId);
    } catch (error) {
      planError = error instanceof Error ? error.message : '공유 데이터를 적용할 수 없습니다.';
    }
  }

  const applyImport = async () => {
    if (!bundle || !plan) return;
    setApplying(true);
    setMessage(null);
    try {
      await withLyricsLibraryWriteLock(async () => {
        let previousLibrary: string | null;
        try {
          previousLibrary = localStorage.getItem(LOCAL_STORAGE_KEYS.songLibrary);
          localStorage.setItem(LOCAL_STORAGE_KEYS.songLibrary, JSON.stringify(plan.library));
        } catch (error) {
          throw new Error('곡 보관함을 저장할 공간이나 권한이 부족합니다.', { cause: error });
        }

        try {
          if (bundle.lyrics?.length) await saveStoredLyricsBatch(bundle.lyrics);
        } catch (error) {
          try {
            if (previousLibrary === null) localStorage.removeItem(LOCAL_STORAGE_KEYS.songLibrary);
            else localStorage.setItem(LOCAL_STORAGE_KEYS.songLibrary, previousLibrary);
          } catch (rollbackError) {
            throw new Error('가사 저장에 실패했고 기존 곡 보관함도 복구하지 못했습니다.', {
              cause: rollbackError,
            });
          }
          throw error;
        }
      });
      let selection = { playlistId: currentPlaylistId, songSlug: currentSong.slug };
      if (bundle.scope.kind === 'song') {
        selection = { playlistId: currentPlaylistId, songSlug: bundle.scope.song.slug };
      } else if (bundle.scope.kind === 'playlist') {
        selection = {
          playlistId: bundle.scope.playlist.id,
          songSlug: bundle.scope.playlist.songSlugs[0]!,
        };
      } else {
        const playlist =
          plan.library.playlists.find(candidate => candidate.id === currentPlaylistId && candidate.songSlugs.length) ??
          plan.library.playlists.find(candidate => candidate.songSlugs.length)!;
        selection = {
          playlistId: playlist.id,
          songSlug: playlist.songSlugs.includes(currentSong.slug) ? currentSong.slug : playlist.songSlugs[0]!,
        };
      }
      onImport(plan.library, selection);
      setView('done');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '공유 데이터를 저장하지 못했습니다.');
    } finally {
      setApplying(false);
    }
  };

  const back = () => {
    setMessage(null);
    if (view === 'sending') {
      setFrames([]);
      setView('send');
      return;
    }
    if (view === 'send' || view === 'receive') {
      resetReceive();
      setView('home');
      return;
    }
    setView('receive');
    setBundle(null);
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
        <p className="sr-only" aria-live="polite">
          {view === 'confirm' ? 'QR 수신이 끝났습니다. 가져올 내용을 확인해 주세요.' : ''}
          {view === 'done' ? '공유 데이터를 이 기기에 가져왔습니다.' : ''}
        </p>
        <ShareHeader
          title={
            view === 'home'
              ? '기기 간 공유'
              : view === 'send'
                ? '보낼 데이터'
                : view === 'sending'
                  ? 'QR 보내기'
                  : view === 'receive'
                    ? 'QR 받기'
                    : view === 'confirm'
                      ? '가져오기 확인'
                      : '가져오기 완료'
          }
          description={
            view === 'home'
              ? '재생목록과 가사를 옮깁니다'
              : view === 'sending'
                ? '받는 기기에 이 화면을 보여 주세요'
                : view === 'receive'
                  ? '보내는 기기의 QR을 맞춰 주세요'
                  : '서버를 거치지 않는 기기 간 이동'
          }
          onBack={view === 'home' || view === 'done' ? undefined : back}
        />

        <div className="min-h-0 flex-1 overflow-y-auto">
          {view === 'home' && (
            <div className="space-y-5 p-4">
              <div className="grid gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-20 justify-start rounded-none p-4 text-left"
                  onClick={() => setView('send')}
                >
                  <Send className="size-5 stroke-[1.5]" />
                  <span>
                    <span className="block font-medium">보내기</span>
                    <span className="text-muted-foreground block text-xs font-normal">
                      이 기기의 곡과 재생목록을 QR로 표시
                    </span>
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-20 justify-start rounded-none p-4 text-left"
                  onClick={() => setView('receive')}
                >
                  <ScanLine className="size-5 stroke-[1.5]" />
                  <span>
                    <span className="block font-medium">받기</span>
                    <span className="text-muted-foreground block text-xs font-normal">
                      다른 기기의 QR을 카메라로 스캔
                    </span>
                  </span>
                </Button>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                QR 데이터와 카메라 영상은 운영자 서버로 보내지 않습니다. 테마와 재생 위치 같은 기기 설정도 공유하지
                않습니다.
              </p>
            </div>
          )}

          {view === 'send' && (
            <div className="flex min-h-full flex-col">
              <div className="flex-1 space-y-5 p-4">
                <RadioGroup value={scope} onValueChange={value => setScope(value as ShareScopeKind)}>
                  <ScopeOption
                    value="song"
                    title="현재 곡"
                    description={`${currentSong.titleJa} · ${currentSong.titleKo}`}
                    icon={ListMusic}
                  />
                  <ScopeOption
                    value="playlist"
                    title="현재 재생목록"
                    description={`${currentPlaylist.name} · ${currentPlaylist.songSlugs.length}곡`}
                    icon={Library}
                  />
                  <ScopeOption
                    value="library"
                    title="전체 보관함"
                    description={`${library.playlists.length}개 재생목록 · ${library.songs.length}곡`}
                    icon={QrCode}
                  />
                </RadioGroup>

                <div className="border-border flex items-center justify-between gap-4 border-y py-4">
                  <div>
                    <Label htmlFor="share-lyrics" className="font-medium">
                      저장된 가사도 포함
                    </Label>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {lyricsLoading
                        ? '가사 확인 중'
                        : includeLyrics
                          ? `${includedLyricsCount}곡 포함`
                          : '포함하지 않음'}
                    </p>
                  </div>
                  {/* 이 앱의 컨트롤은 전부 각지다. Switch만 shadcn 기본 pill이라 각을 맞춘다. */}
                  <Switch
                    id="share-lyrics"
                    checked={includeLyrics}
                    disabled={lyricsLoading}
                    onCheckedChange={setIncludeLyrics}
                    className="rounded-none [&_[data-slot=switch-thumb]]:rounded-none"
                  />
                </div>
                {includeLyrics && (
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    직접 작성했거나 공유할 권한이 있는 가사만 포함해 주세요. 가사가 많으면 QR 표시 시간이 길어집니다.
                  </p>
                )}
              </div>
              <div className="border-border space-y-2 border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <Button type="button" className="min-h-11 w-full rounded-none" disabled={building} onClick={createQr}>
                  <QrCode />
                  {building ? 'QR 만드는 중…' : 'QR 만들기'}
                </Button>
                {shareFileFormat && (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 w-full rounded-none"
                    disabled={sharing}
                    onClick={shareToDevice}
                  >
                    <Share2 />
                    {sharing ? '공유하는 중…' : '기기로 바로 공유'}
                  </Button>
                )}
                <Button type="button" variant="ghost" className="min-h-11 w-full" onClick={saveFile}>
                  <FileDown />
                  공유 파일 저장
                </Button>
              </div>
            </div>
          )}

          {view === 'sending' && frames[frameIndex] && (
            <div className="flex min-h-full flex-col items-center justify-center gap-5 p-4">
              <div className="w-full max-w-80 bg-white">
                <QRCodeSVG
                  value={frames[frameIndex]}
                  size={320}
                  level="M"
                  marginSize={4}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  boostLevel={false}
                  title="노래 데이터 공유 QR"
                  className="block size-full"
                />
              </div>
              <div className="w-full max-w-80 space-y-2 text-center">
                <p className="font-utility text-sm tabular-nums">
                  {frameIndex + 1} / {frames.length} 표시 중{frames.length > 1 ? ' · 반복 표시' : ''}
                </p>
                <Progress value={((frameIndex + 1) / frames.length) * 100} aria-label="QR 표시 순서" className="h-1" />
                <p className="text-muted-foreground text-xs">
                  받는 기기가 모든 조각을 모을 때까지 화면을 유지해 주세요.
                </p>
              </div>
            </div>
          )}

          {view === 'receive' && (
            <div className="flex min-h-full flex-col">
              <div className="flex-1 space-y-4 p-4">
                <div
                  className={cn(
                    'border-border bg-muted relative flex aspect-square max-h-[20rem] w-full items-center justify-center overflow-hidden border',
                    cameraActive && 'bg-black'
                  )}
                >
                  <video
                    ref={videoRef}
                    aria-label="QR 스캔 카메라"
                    className="size-full object-cover"
                    muted
                    playsInline
                  />
                  {!cameraActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                      <Camera className="text-muted-foreground size-7 stroke-[1.25]" />
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        버튼을 누른 뒤에만 카메라 권한을 요청합니다.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-none"
                        disabled={cameraStarting}
                        onClick={startCamera}
                      >
                        {cameraStarting ? '카메라 여는 중…' : '카메라 켜기'}
                      </Button>
                    </div>
                  )}
                </div>
                {receiveProgress.total > 0 && (
                  <div className="space-y-2">
                    <p className="font-utility text-center text-sm tabular-nums">
                      {receiveProgress.received} / {receiveProgress.total} 조각 받는 중
                    </p>
                    <Progress
                      value={(receiveProgress.received / receiveProgress.total) * 100}
                      aria-label="QR 수신 진행률"
                    />
                  </div>
                )}
                <p className="text-muted-foreground text-center text-xs">
                  카메라 영상은 이 기기 안에서만 읽고 저장하지 않습니다.
                </p>
              </div>
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
            <div className="flex min-h-full flex-col">
              <div className="flex-1 space-y-5 p-4">
                <div className="border-border grid grid-cols-3 divide-x border-y py-4 text-center">
                  <div>
                    <strong className="font-utility block text-lg tabular-nums">{plan.summary.playlistCount}</strong>
                    <span className="text-muted-foreground text-xs">재생목록</span>
                  </div>
                  <div>
                    <strong className="font-utility block text-lg tabular-nums">{plan.summary.songCount}</strong>
                    <span className="text-muted-foreground text-xs">곡</span>
                  </div>
                  <div>
                    <strong className="font-utility block text-lg tabular-nums">{plan.summary.lyricCount}</strong>
                    <span className="text-muted-foreground text-xs">가사</span>
                  </div>
                </div>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">새로 추가</dt>
                    <dd>
                      곡 {plan.summary.newSongCount} · 재생목록 {plan.summary.newPlaylistCount}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">기존 항목 변경</dt>
                    <dd>
                      곡 {plan.summary.changedSongCount} · 재생목록 {plan.summary.changedPlaylistCount}
                    </dd>
                  </div>
                  {plan.summary.kind === 'library' &&
                    (plan.summary.removedSongCount > 0 || plan.summary.removedPlaylistCount > 0) && (
                      <div className="text-destructive flex justify-between gap-4">
                        <dt>보관함에서 제외</dt>
                        <dd>
                          곡 {plan.summary.removedSongCount} · 재생목록 {plan.summary.removedPlaylistCount}
                        </dd>
                      </div>
                    )}
                </dl>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {plan.summary.includesLyrics
                    ? 'QR에 포함된 곡의 가사는 덮어씁니다. 다른 곡의 기존 가사는 지우지 않습니다.'
                    : '가사는 포함되지 않았으며 이 기기에 저장된 가사는 그대로 둡니다.'}
                </p>
              </div>
              <div className="border-border border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <Button
                  type="button"
                  variant={plan.summary.kind === 'library' ? 'destructive' : 'default'}
                  className="min-h-11 w-full rounded-none"
                  disabled={applying}
                  onClick={applyImport}
                >
                  {applying ? '저장하는 중…' : importButtonLabel(plan.summary.kind)}
                </Button>
              </div>
            </div>
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

        {(message ?? planError) && (
          <p role="alert" className="border-border text-destructive shrink-0 border-t px-4 py-3 text-xs">
            {message ?? planError}
          </p>
        )}
      </DrawerContent>
    </Drawer>
  );
}
