import { Download, Trash2 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@mumak/ui/components/button';

import { LyricsImportButton } from '@/components/lyrics-import-button';
import { serializeLyricsLibraryBackup } from '@/lib/lyrics-import';
import {
  clearStoredLyrics,
  deleteStoredLyrics,
  listStoredLyrics,
  readStoredLyricsLibrary,
  subscribeLyricsChanges,
  withLyricsLibraryWriteLock,
} from '@/lib/lyrics-storage';

type LibraryMessage = { kind: 'error' | 'success'; text: string } | null;

function downloadJson(fileName: string, contents: string) {
  const file = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function LyricsLibrary({ songSlugs }: { songSlugs: readonly string[] }) {
  const [storedSlugs, setStoredSlugs] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = React.useState<LibraryMessage>(null);
  const [exporting, setExporting] = React.useState(false);
  const knownSlugSet = new Set(songSlugs);
  const knownStoredCount = storedSlugs.filter(slug => knownSlugSet.has(slug)).length;
  const extraStoredCount = storedSlugs.length - knownStoredCount;

  const refresh = React.useCallback(() => {
    void listStoredLyrics()
      .then(slugs => {
        setStoredSlugs(slugs);
        setStatus('ready');
      })
      .catch(error => {
        setStatus('error');
        setMessage({
          kind: 'error',
          text: error instanceof Error ? error.message : '기기 저장소를 확인하지 못했습니다.',
        });
      });
  }, []);

  React.useEffect(() => {
    refresh();
    return subscribeLyricsChanges(refresh);
  }, [refresh]);

  const clear = async () => {
    setMessage(null);
    try {
      const cleared = await withLyricsLibraryWriteLock(async () => {
        if (!window.confirm('이 기기에 저장된 가사를 모두 지울까요? 백업이 없으면 되돌릴 수 없습니다.')) {
          return false;
        }
        await clearStoredLyrics();
        return true;
      });
      if (!cleared) return;
      setMessage({ kind: 'success', text: '이 기기의 가사를 모두 지웠습니다.' });
    } catch (error) {
      setMessage({
        kind: 'error',
        text: error instanceof Error ? error.message : '기기 저장소를 비우지 못했습니다.',
      });
    }
  };

  const remove = async (slug: string) => {
    setMessage(null);
    try {
      const removed = await withLyricsLibraryWriteLock(async () => {
        if (!window.confirm(`${slug}에 저장된 가사만 지울까요? 백업이 없으면 되돌릴 수 없습니다.`)) return false;
        await deleteStoredLyrics(slug);
        return true;
      });
      if (!removed) return;
      setStoredSlugs(current => current.filter(storedSlug => storedSlug !== slug));
      setMessage({ kind: 'success', text: `${slug} 가사를 지웠습니다.` });
    } catch (error) {
      setMessage({
        kind: 'error',
        text: error instanceof Error ? error.message : '곡의 가사를 지우지 못했습니다.',
      });
    }
  };

  const exportBackup = async () => {
    setExporting(true);
    setMessage(null);
    try {
      const library = await readStoredLyricsLibrary();
      if (library.entries.length === 0) {
        throw new Error(
          library.skippedRecordCount > 0
            ? '저장소가 손상되어 백업 가능한 가사가 없습니다. 원본 파일을 확인한 뒤 저장소를 초기화해 주세요.'
            : '내보낼 가사가 없습니다.'
        );
      }
      downloadJson(
        `karaoke-lyrics-backup-${new Date().toISOString().slice(0, 10)}.json`,
        serializeLyricsLibraryBackup(library.entries)
      );
      setMessage({
        kind: 'success',
        text:
          library.skippedRecordCount > 0
            ? `${library.entries.length}곡의 백업을 저장했습니다. 읽을 수 없는 ${library.skippedRecordCount}개 레코드는 제외했습니다.`
            : `${library.entries.length}곡의 백업을 저장했습니다.`,
      });
    } catch (error) {
      setMessage({
        kind: 'error',
        text: error instanceof Error ? error.message : '가사 백업을 만들지 못했습니다.',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="border-border space-y-3 border-y py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-foreground text-[0.68rem] font-semibold tracking-[0.16em] uppercase">내 가사 보관함</p>
        <p className="text-muted-foreground text-xs tabular-nums">
          {status === 'loading'
            ? '확인 중'
            : status === 'error'
              ? '확인 실패'
              : `${knownStoredCount}/${songSlugs.length}곡${extraStoredCount > 0 ? ` · 기타 ${extraStoredCount}` : ''}`}
        </p>
      </div>
      <p className="text-muted-foreground">
        선택한 가사 파일은 별도 서버에 업로드하지 않고 이 기기에만 저장합니다. 한 번 불러오면 오프라인에서도 그대로
        열립니다. 브라우저 데이터를 지우기 전에는 백업을 내보내 주세요.
      </p>
      <p className="text-muted-foreground text-xs">
        저장 원리 · 가사는 브라우저가 제공하는 기기 내 저장 공간(IndexedDB)에 보관됩니다.
      </p>
      <p className="text-muted-foreground text-xs">
        여러 곡은 이 앱에서 내보낸 백업 파일 하나에 곡 정보를 함께 담아 구분합니다.
      </p>
      <div className="flex flex-wrap items-start gap-2">
        <LyricsImportButton songSlugs={songSlugs} label="백업 또는 가사 파일 불러오기" />
        {storedSlugs.length > 0 && (
          <>
            <Button
              type="button"
              variant="outline"
              className="border-foreground/20 hover:border-foreground/40 min-h-11 rounded-none px-3"
              disabled={exporting}
              onClick={() => void exportBackup()}
            >
              <Download className="size-4" />
              {exporting ? '내보내는 중…' : '백업 내보내기'}
            </Button>
          </>
        )}
      </div>
      {storedSlugs.length > 0 && (
        <details className="border-border border-t pt-3">
          <summary className="text-muted-foreground cursor-pointer text-xs font-medium">저장된 가사 관리</summary>
          <ul className="mt-2 space-y-1">
            {storedSlugs.map(slug => (
              <li key={slug} className="border-border flex min-h-11 items-center justify-between gap-3 border-b">
                <span className="font-utility truncate text-xs">{slug}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  aria-label={`${slug} 가사 지우기`}
                  onClick={() => void remove(slug)}
                >
                  <Trash2 />
                  지우기
                </Button>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive mt-3"
            onClick={() => void clear()}
          >
            <Trash2 />
            저장된 가사 모두 지우기
          </Button>
        </details>
      )}
      {message && (
        <p
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={message.kind === 'error' ? 'text-destructive text-xs' : 'text-muted-foreground text-xs'}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
