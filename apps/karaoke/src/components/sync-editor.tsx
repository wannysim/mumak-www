import { Check, Copy, Save, Timer, Undo2 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@mumak/ui/components/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@mumak/ui/components/drawer';
import { Textarea } from '@mumak/ui/components/textarea';

import type { LyricLine } from '@/lib/lyrics';
import { parseLyricsFile } from '@/lib/lyrics-import';
import { listStoredLyrics, saveStoredLyrics, withLyricsLibraryWriteLock } from '@/lib/lyrics-storage';

function parseLine(raw: string, time: number): LyricLine {
  const [jp = '', pron = '', ko = ''] = raw.split('|').map(part => part.trim());
  return { time, jp, pron, ko };
}

/**
 * 가사 타임스탬프 제작 도구. 노래를 틀어 두고 줄이 시작될 때마다 "지금" 버튼을
 * 눌러 시간을 찍은 뒤, 완성된 가사를 사용자의 기기 저장소에만 저장한다.
 */
export function SyncEditor({ time, songSlug }: { time: number; songSlug: string }) {
  const [text, setText] = React.useState('');
  const [stamps, setStamps] = React.useState<number[]>([]);
  const [saveState, setSaveState] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const nextIndex = stamps.length;
  const done = lines.length > 0 && nextIndex >= lines.length;

  const markDraftChanged = () => {
    setSaveState('idle');
    setSaveError('');
    setCopied(false);
  };

  const stamp = () => {
    if (done) return;
    markDraftChanged();
    setStamps(prev => [...prev, Math.round(time * 10) / 10]);
  };

  const undoStamp = () => {
    markDraftChanged();
    setStamps(prev => prev.slice(0, -1));
  };

  const save = async () => {
    if (!done) return;
    setSaveState('saving');
    setSaveError('');
    try {
      const result = lines.map((line, index) => parseLine(line, stamps[index] ?? 0));
      const parsedLyrics = parseLyricsFile(result).lyrics;
      const saved = await withLyricsLibraryWriteLock(async () => {
        const storedSlugs = await listStoredLyrics();
        if (
          storedSlugs.includes(songSlug) &&
          !window.confirm('현재 곡에 저장된 가사를 새 내용으로 바꿀까요? 기존 내용은 되돌릴 수 없습니다.')
        ) {
          return false;
        }
        await saveStoredLyrics(songSlug, parsedLyrics);
        return true;
      });
      if (!saved) {
        setSaveState('idle');
        return;
      }
      setSaveState('saved');
    } catch (error) {
      setSaveState('error');
      setSaveError(error instanceof Error ? error.message : '가사를 저장하지 못했습니다.');
    }
  };

  const copyBackup = async () => {
    try {
      const result = lines.map((line, index) => parseLine(line, stamps[index] ?? 0));
      const parsedLyrics = parseLyricsFile(result).lyrics;
      await navigator.clipboard.writeText(JSON.stringify({ slug: songSlug, lyrics: parsedLyrics }, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      setSaveState('error');
      setSaveError(error instanceof Error ? error.message : 'JSON 백업을 만들지 못했습니다.');
    }
  };

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="싱크 편집 모드"
          className="size-11 rounded-none hover:bg-transparent"
        >
          <Timer className="size-5" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>싱크 편집</DrawerTitle>
          <DrawerDescription>
            한 줄에 「日本語 | 발음 | 번역」. 완성된 가사는 앱 서버가 아니라 이 브라우저의 IndexedDB에 저장됩니다.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-3 px-4 pb-8">
          <Textarea
            value={text}
            onChange={event => {
              setText(event.target.value);
              setStamps([]);
              setSaveState('idle');
              setSaveError('');
              setCopied(false);
            }}
            rows={5}
            placeholder={'練習の一行 | 렌슈노 이치교 | 연습용 한 줄\n...'}
            className="text-sm"
          />
          {lines.length > 0 && (
            <>
              <p className="text-muted-foreground truncate text-center text-sm" lang="ja">
                {done ? '모든 줄 완료!' : `다음: ${lines[nextIndex]}`}
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" size="lg" className="flex-1" onClick={stamp} disabled={done}>
                  지금! ({time.toFixed(1)}s · {nextIndex}/{lines.length})
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="마지막 스탬프 취소"
                  onClick={undoStamp}
                  disabled={nextIndex === 0}
                >
                  <Undo2 />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="이 기기에 저장"
                  onClick={() => void save()}
                  disabled={!done || saveState === 'saving'}
                >
                  {saveState === 'saved' ? <Check /> : <Save />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="JSON 백업 복사"
                  onClick={() => void copyBackup()}
                  disabled={!done}
                >
                  {copied ? <Check /> : <Copy />}
                </Button>
              </div>
              {saveState === 'saved' && (
                <p role="status" className="text-muted-foreground text-center text-xs">
                  이 기기에 저장했습니다.
                </p>
              )}
              {saveState === 'error' && (
                <p role="alert" className="text-destructive text-center text-xs">
                  {saveError}
                </p>
              )}
              {copied && (
                <p role="status" className="text-muted-foreground text-center text-xs">
                  JSON을 클립보드에 복사했습니다.
                </p>
              )}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
