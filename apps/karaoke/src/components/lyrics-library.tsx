import { Download, Trash2 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@mumak/ui/components/button';

import { LyricsImportButton } from '@/components/lyrics-import-button';
import { serializeLyricsLibraryBackup } from '@/lib/lyrics-import';
import {
  clearStoredLyrics,
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
        <p className="text-foreground text-[0.68rem] font-semibold tracking-[0.16em] uppercase">Local · IndexedDB</p>
        <p className="text-muted-foreground text-xs tabular-nums">
          {status === 'loading'
            ? '확인 중'
            : status === 'error'
              ? '확인 실패'
              : `${knownStoredCount}/${songSlugs.length}곡${extraStoredCount > 0 ? ` · 기타 ${extraStoredCount}` : ''}`}
        </p>
      </div>
      <p className="text-muted-foreground">
        가사 불러오기 기능은 선택한 JSON을 별도 서버에 업로드하지 않고 이 브라우저의 IndexedDB에 저장합니다. 한 번
        불러오면 오프라인에서도 그대로 열립니다. 브라우저 데이터를 지우기 전에는 백업을 내보내 주세요.
      </p>
      <div className="flex flex-wrap items-start gap-2">
        <LyricsImportButton songSlugs={songSlugs} />
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
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground min-h-11 rounded-none px-3"
              onClick={() => void clear()}
            >
              <Trash2 className="size-4" />
              모두 지우기
            </Button>
          </>
        )}
      </div>
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
