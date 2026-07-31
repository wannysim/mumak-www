import { FileUp } from 'lucide-react';
import * as React from 'react';

import { Button } from '@mumak/ui/components/button';

import {
  isLyricsLibraryBackup,
  MAX_LYRICS_BACKUP_SIZE,
  parseLyricsImportFile,
  slugFromFileName,
} from '@/lib/lyrics-import';
import { listStoredLyrics, saveStoredLyricsBatch, withLyricsLibraryWriteLock } from '@/lib/lyrics-storage';

const MAX_SINGLE_FILE_SIZE = 2 * 1024 * 1024;
const MAX_FILE_COUNT = 50;

type ImportMessage = { kind: 'error'; text: string } | { kind: 'success'; text: string } | null;

export function LyricsImportButton({
  songSlugs,
  targetSongSlug,
  className,
  label = '가사 파일 불러오기',
  onImported,
}: React.ComponentProps<'div'> & {
  songSlugs: readonly string[];
  targetSongSlug?: string;
  label?: string;
  onImported?: (slugs: string[]) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const messageRef = React.useRef<HTMLParagraphElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<ImportMessage>(null);

  React.useEffect(() => {
    if (message) messageRef.current?.scrollIntoView({ block: 'nearest' });
  }, [message]);

  const importFiles = async (files: File[]) => {
    if (files.length === 0) return;
    if (targetSongSlug && files.length !== 1) {
      setMessage({ kind: 'error', text: '현재 곡에는 가사 파일 한 개만 불러올 수 있습니다.' });
      return;
    }
    if (files.length > MAX_FILE_COUNT) {
      setMessage({ kind: 'error', text: `한 번에 ${MAX_FILE_COUNT}개 파일까지 불러올 수 있습니다.` });
      return;
    }
    if (files.reduce((total, file) => total + file.size, 0) > MAX_LYRICS_BACKUP_SIZE) {
      setMessage({ kind: 'error', text: '한 번에 선택한 파일의 합계는 24MB까지 불러올 수 있습니다.' });
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const knownSlugs = new Set(songSlugs);
      const parsed = await Promise.all(
        files.map(async file => {
          if (file.size > MAX_LYRICS_BACKUP_SIZE) throw new Error(`${file.name}: 파일이 24MB보다 큽니다.`);

          let value: unknown;
          try {
            value = JSON.parse(await file.text()) as unknown;
          } catch {
            throw new Error(`${file.name}: JSON을 읽을 수 없습니다.`);
          }

          const isBackup = isLyricsLibraryBackup(value);
          if (targetSongSlug && isBackup) {
            throw new Error(`${file.name}: 전체 백업은 ‘이 앱에 대해’의 내 가사 보관함에서 불러와 주세요.`);
          }
          let results: ReturnType<typeof parseLyricsImportFile>;
          try {
            results = parseLyricsImportFile(value);
          } catch (error) {
            throw new Error(
              `${file.name}: ${error instanceof Error ? error.message : '지원하지 않는 가사 형식입니다.'}`,
              { cause: error }
            );
          }
          if (!isBackup && file.size > MAX_SINGLE_FILE_SIZE) {
            throw new Error(`${file.name}: 한 곡 파일이 2MB보다 큽니다.`);
          }
          if (targetSongSlug) {
            const result = results[0];
            if (!result) throw new Error(`${file.name}: 저장할 가사가 없습니다.`);
            if (result.slug && result.slug !== targetSongSlug) {
              throw new Error(`${file.name}: 현재 곡과 다른 곡의 가사 파일입니다.`);
            }
            return {
              entries: [{ slug: targetSongSlug, lyrics: result.lyrics }],
              archivedCount: 0,
            };
          }

          const fileSlug = slugFromFileName(file.name);
          const entries = results.flatMap(result => {
            const slug = result.slug ?? (results.length === 1 && knownSlugs.has(fileSlug) ? fileSlug : undefined);

            if (!slug || (!isBackup && !knownSlugs.has(slug))) {
              throw new Error(
                `${file.name}: 곡을 찾을 수 없습니다. 파일 이름을 곡 slug와 맞추거나 JSON에 slug를 넣어 주세요.`
              );
            }
            return { slug, lyrics: result.lyrics };
          });
          return {
            entries,
            archivedCount: isBackup ? entries.filter(entry => !knownSlugs.has(entry.slug)).length : 0,
          };
        })
      );
      const entries = parsed.flatMap(result => result.entries);
      const archivedCount = parsed.reduce((total, result) => total + result.archivedCount, 0);
      if (entries.length === 0) throw new Error('선택한 파일에 저장할 가사가 없습니다.');

      const uniqueSlugs = new Set(entries.map(item => item.slug));
      if (uniqueSlugs.size !== entries.length) throw new Error('같은 곡의 파일이 두 개 이상 선택됐습니다.');

      const saved = await withLyricsLibraryWriteLock(async () => {
        const storedSlugs = new Set(await listStoredLyrics());
        const replacements = entries.filter(item => storedSlugs.has(item.slug));
        if (
          replacements.length > 0 &&
          !window.confirm(
            `이미 저장된 ${replacements.length}곡의 가사를 새 파일로 바꿀까요? 기존 내용은 되돌릴 수 없습니다.`
          )
        ) {
          return false;
        }

        await saveStoredLyricsBatch(entries);
        return true;
      });
      if (!saved) return;

      const importedSlugs = [...uniqueSlugs];
      setMessage({
        kind: 'success',
        text:
          archivedCount > 0
            ? `${importedSlugs.length}곡을 이 기기에 저장했습니다. 현재 목록에 없는 ${archivedCount}곡도 백업 보존용으로 저장했습니다.`
            : `${importedSlugs.length}곡을 이 기기에 저장했습니다.`,
      });
      onImported?.(importedSlugs);
    } catch (error) {
      setMessage({
        kind: 'error',
        text: error instanceof Error ? error.message : '가사 파일을 불러오지 못했습니다.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        multiple={!targetSongSlug}
        hidden
        tabIndex={-1}
        aria-hidden="true"
        onChange={event => {
          void importFiles(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = '';
        }}
      />
      <Button
        type="button"
        variant="outline"
        data-tour={targetSongSlug ? 'lyrics-file-import' : undefined}
        className="border-foreground/20 hover:border-foreground/40 min-h-11 rounded-none"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <FileUp className="size-4" />
        {busy ? '불러오는 중…' : label}
      </Button>
      {message && (
        <p
          ref={messageRef}
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={message.kind === 'error' ? 'text-destructive mt-2 text-xs' : 'text-muted-foreground mt-2 text-xs'}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
