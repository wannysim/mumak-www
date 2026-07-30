import { Braces, Check, Copy, FilePenLine, Pause, Play, Plus, Save, Timer, Trash2 } from 'lucide-react';
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
import { Input } from '@mumak/ui/components/input';
import { Label } from '@mumak/ui/components/label';
import { Textarea } from '@mumak/ui/components/textarea';

import { formatTime } from '@/lib/format-time';
import type { LyricLine } from '@/lib/lyrics';
import { parseLyricsFile } from '@/lib/lyrics-import';
import { listStoredLyrics, saveStoredLyrics, withLyricsLibraryWriteLock } from '@/lib/lyrics-storage';

type DraftLine = Omit<LyricLine, 'time'> & { time: number | null };
type ImportStage = 'source' | 'result';

const AI_PROMPT = `아래 일본어 가사를 노래에서 부르는 줄 단위로 정리해 주세요.

출력은 다음 JSON 형식만 사용합니다.

[
  { "time": 12.3, "jp": "練習の歌", "pron": "렌슈노 우타", "ko": "연습의 노래" },
  { "time": null, "jp": "次の歌詞", "pron": "츠기노 카시", "ko": "다음 가사" }
]

규칙:
- 입력에 LRC·자막처럼 확인 가능한 타임코드가 있으면 time을 영상 시작 기준 초 단위 숫자로 변환합니다.
- 확인 가능한 시간 근거가 없으면 time은 null로 둡니다.
- 타임코드를 추측하거나 가사 길이로 균등 배분하지 않습니다.
- 노래에서 부르는 한 줄을 JSON 한 항목으로 유지합니다.
- 아래에 제공된 일본어 원문만 사용하고, 영상이나 웹에서 가사를 새로 찾거나 보충하지 않습니다.
- 발음은 한국어 화자가 따라 부르기 쉽게 한글로 쓰고, ko는 자연스러운 한국어 번역으로 씁니다.
- 설명, 제목, 마크다운 코드 블록 없이 JSON 배열만 답합니다.`;

async function copyText(text: string) {
  let clipboardCopy = Promise.resolve(false);
  try {
    clipboardCopy =
      navigator.clipboard
        ?.writeText(text)
        .then(() => true)
        .catch(() => false) ?? clipboardCopy;
  } catch {
    // 일부 브라우저는 권한이 막히면 Promise 대신 즉시 예외를 던진다.
  }
  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.append(textarea);

  let nativeCopy = false;
  try {
    textarea.focus();
    textarea.select();
    nativeCopy = typeof document.execCommand === 'function' && document.execCommand('copy');
  } finally {
    textarea.remove();
    activeElement?.focus();
  }

  if (!nativeCopy && !(await clipboardCopy)) throw new Error('copy failed');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function draftLinesFromJson(value: unknown): DraftLine[] {
  const rawLines = Array.isArray(value) ? value : isRecord(value) && Array.isArray(value.lyrics) ? value.lyrics : null;
  if (!rawLines?.some(line => isRecord(line) && line.time == null)) {
    return parseLyricsFile(value).lyrics;
  }

  const validated = parseLyricsFile(
    rawLines.map((line, index) => (isRecord(line) ? { ...line, time: index } : line))
  ).lyrics;

  return validated.map((line, index) => {
    const rawLine = rawLines[index];
    const rawTime = isRecord(rawLine) ? rawLine.time : undefined;
    if (rawTime == null) return { ...line, time: null };
    if (typeof rawTime !== 'number' || !Number.isFinite(rawTime) || rawTime < 0) {
      throw new Error(`${index + 1}번째 줄의 시간이 올바르지 않습니다.`);
    }
    return { ...line, time: rawTime };
  });
}

function draftLinesFromText(text: string): DraftLine[] {
  const normalized = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  const hasLrcTimestamp = /(?:^|\n)\s*\[\d+:\d+(?:[.:]\d+)?\]/.test(normalized);
  if (!hasLrcTimestamp && (normalized.startsWith('[') || normalized.startsWith('{'))) {
    let value: unknown;
    try {
      value = JSON.parse(normalized) as unknown;
    } catch {
      throw new Error('JSON 형식을 읽을 수 없습니다.');
    }
    return draftLinesFromJson(value);
  }

  const offsetSeconds = Number(normalized.match(/^\s*\[offset:([+-]?\d+)\]\s*$/im)?.[1] ?? 0) / 1_000;
  const lrcLines = normalized
    .split(/\r?\n/)
    .flatMap((rawLine, index) => {
      const timestamps = [...rawLine.matchAll(/\[(\d+):(\d+(?:[.:]\d+)?)\]/g)];
      const jp = rawLine.replaceAll(/\[\d+:\d+(?:[.:]\d+)?\]/g, '').trim();
      return timestamps.map(match => {
        const seconds = Number(match[2]!.replace(':', '.'));
        if (seconds >= 60) throw new Error(`${index + 1}번째 줄의 LRC 시간을 읽을 수 없습니다.`);
        return { time: Math.max(0, Number(match[1]) * 60 + seconds + offsetSeconds), jp, pron: '', ko: '' };
      });
    })
    .filter(line => line.jp && Number.isFinite(line.time))
    .toSorted((left, right) => left.time - right.time);
  if (lrcLines.length > 0) return parseLyricsFile(lrcLines).lyrics;

  return normalized
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const fields = line.split(/\s*[|\t]\s*/);
      if (fields.length < 4) {
        const [jp = '', pron = '', ko = ''] = fields;
        return { time: null, jp, pron, ko };
      }

      const [timestamp = '', jp = '', pron = '', ko = ''] = fields;
      const parts = timestamp.split(':').map(Number);
      const validTimestamp =
        parts.length <= 3 &&
        parts.every(part => Number.isFinite(part) && part >= 0) &&
        (parts.length === 1 || parts.slice(1).every(part => part < 60));
      if (!validTimestamp) throw new Error(`${index + 1}번째 줄의 시간을 읽을 수 없습니다.`);

      return {
        time: parts.reduce((seconds, part) => seconds * 60 + part),
        jp,
        pron,
        ko,
      };
    });
}

function parsedDraft(lines: DraftLine[]): LyricLine[] {
  return parseLyricsFile(
    lines.map(line => ({
      ...line,
      time: line.time ?? Number.NaN,
    }))
  ).lyrics;
}

const EMPTY_LYRICS: LyricLine[] = [];

/**
 * 가사를 줄 단위로 정리하고, 노래를 왕복 재생하며 각 줄의 시작 시간을 찍는 제작 도구.
 * 완성된 가사는 사용자의 기기 저장소에만 저장한다.
 */
export function SyncEditor({
  time,
  duration = 0,
  isPlaying = false,
  lyrics = EMPTY_LYRICS,
  songSlug,
  songTitle = songSlug,
  onSeek = () => {},
  onTogglePlay = () => {},
}: {
  time: number;
  duration?: number;
  isPlaying?: boolean;
  lyrics?: LyricLine[];
  songSlug: string;
  songTitle?: string;
  onSeek?: (seconds: number) => void;
  onTogglePlay?: () => void;
}) {
  const [sourceText, setSourceText] = React.useState('');
  const [resultText, setResultText] = React.useState('');
  const [lines, setLines] = React.useState<DraftLine[]>([]);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [preparing, setPreparing] = React.useState(true);
  const [importStage, setImportStage] = React.useState<ImportStage>('source');
  const [saveState, setSaveState] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = React.useState('');
  const [preparationError, setPreparationError] = React.useState('');
  const [copied, setCopied] = React.useState<'prompt' | 'backup' | null>(null);
  const [promptCopyError, setPromptCopyError] = React.useState('');
  const edited = React.useRef(false);
  const syncStepRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    if (edited.current) return;
    setLines(lyrics.map(line => ({ ...line })));
    setActiveIndex(0);
    setPreparing(lyrics.length === 0);
    setImportStage('source');
  }, [lyrics]);

  const activeLine = lines[activeIndex];
  const stampedCount = lines.filter(line => line.time !== null).length;
  const done = lines.length > 0 && stampedCount === lines.length;

  const markDraftChanged = () => {
    edited.current = true;
    setSaveState('idle');
    setSaveError('');
    setPreparationError('');
    setCopied(null);
    setPromptCopyError('');
  };

  const updateActiveLine = (patch: Partial<DraftLine>) => {
    markDraftChanged();
    setLines(current => current.map((line, index) => (index === activeIndex ? { ...line, ...patch } : line)));
  };

  const loadPreparedLines = (prepared: DraftLine[]) => {
    markDraftChanged();
    setLines(prepared);
    const firstMissingTime = prepared.findIndex(line => line.time === null);
    setActiveIndex(firstMissingTime < 0 ? 0 : firstMissingTime);
    setPreparing(false);
    requestAnimationFrame(() => {
      syncStepRef.current?.scrollIntoView({ block: 'start' });
      syncStepRef.current?.focus({ preventScroll: true });
    });
  };

  const prepareLines = () => {
    try {
      const prepared = draftLinesFromText(resultText);
      if (prepared.length === 0) {
        throw new Error('JSON·LRC 데이터를 붙여 넣어 주세요.');
      }
      loadPreparedLines(prepared);
    } catch (error) {
      setPreparationError(error instanceof Error ? error.message : '붙여 넣은 데이터를 읽지 못했습니다.');
    }
  };

  const prepareSourceLines = () => {
    const prepared = sourceText
      .trim()
      .split(/\r?\n/)
      .map(jp => jp.trim())
      .filter(Boolean)
      .map(jp => ({ time: null, jp, pron: '', ko: '' }));
    if (prepared.length === 0) return;

    loadPreparedLines(prepared);
  };

  const updateSourceText = (value: string) => {
    setSourceText(value);
    setCopied(null);
    setPromptCopyError('');
  };

  const updateResultText = (value: string) => {
    setResultText(value);
    setPreparationError('');
    setCopied(null);
  };

  const preparationSummary = done
    ? `${lines.length}줄의 시간이 모두 준비됐습니다. 내용만 확인하고 저장하세요.`
    : `${lines.length - stampedCount}줄의 시간이 비어 있습니다. 노래를 재생하며 시작 순간만 찍으세요.`;

  const promptStatus = promptCopyError
    ? promptCopyError
    : copied === 'prompt'
      ? '복사됐습니다. 사용 중인 AI에 붙여 넣고 답변을 받아오세요.'
      : '';

  const promptStatusRole = promptCopyError ? 'alert' : 'status';

  const preparationActionLabel = lines.length > 0 ? '이 데이터로 가사 교체' : '데이터 적용';

  const sourceActionLabel = lines.length > 0 ? '이 원문으로 가사 교체' : '이 원문으로 가사 만들기';

  const sourceLineCount = sourceText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean).length;

  const resultPlaceholder = `[
  { "time": 12.3, "jp": "練習の歌", "pron": "렌슈노 우타", "ko": "연습의 노래" },
  { "time": null, "jp": "次の歌詞", "pron": "츠기노 카시", "ko": "다음 가사" }
]`;

  const sourcePlaceholder = `一行目の歌詞
二行目の歌詞`;

  const openImport = () => {
    setImportStage('source');
    setPreparationError('');
    setPromptCopyError('');
    setPreparing(true);
  };

  const addLine = () => {
    markDraftChanged();
    const nextIndex = lines.length === 0 ? 0 : activeIndex + 1;
    setLines(current => [
      ...current.slice(0, nextIndex),
      { time: null, jp: '', pron: '', ko: '' },
      ...current.slice(nextIndex),
    ]);
    setActiveIndex(nextIndex);
    setPreparing(false);
  };

  const removeLine = () => {
    if (!activeLine) return;
    markDraftChanged();
    setLines(current => current.filter((_, index) => index !== activeIndex));
    setActiveIndex(index => Math.max(0, Math.min(index, lines.length - 2)));
  };

  const stamp = () => {
    if (!activeLine) return;
    updateActiveLine({ time: Math.round(time * 10) / 10 });
    const nextMissingTime = lines.findIndex((line, index) => index > activeIndex && line.time === null);
    if (nextMissingTime >= 0) setActiveIndex(nextMissingTime);
  };

  const save = async () => {
    if (!done) return;
    setSaveState('saving');
    setSaveError('');
    try {
      const parsedLyrics = parsedDraft(lines);
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
      if (saved) edited.current = false;
      setSaveState(saved ? 'saved' : 'idle');
    } catch (error) {
      setSaveState('error');
      setSaveError(error instanceof Error ? error.message : '가사를 저장하지 못했습니다.');
    }
  };

  const copyPrompt = async () => {
    const sourceLyrics = sourceText.trim();
    if (!sourceLyrics) {
      setPromptCopyError('먼저 일본어 원문을 붙여 넣어 주세요.');
      return;
    }
    try {
      await copyText(`${AI_PROMPT}\n\n곡 제목(참고용): ${songTitle}\n\n변환할 일본어 가사:\n${sourceLyrics}`);
      setPromptCopyError('');
      setCopied('prompt');
      setImportStage('result');
    } catch {
      setPromptCopyError('프롬프트를 클립보드에 복사하지 못했습니다.');
    }
  };

  const copyBackup = async () => {
    try {
      await copyText(JSON.stringify({ slug: songSlug, lyrics: parsedDraft(lines) }, null, 2));
      setCopied('backup');
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
          aria-label="가사 편집 열기"
          data-tour="lyrics-editor-trigger"
          className="size-11 rounded-none hover:bg-transparent"
        >
          <FilePenLine className="size-4 stroke-[1.5]" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[92vh] md:data-[vaul-drawer-direction=bottom]:inset-x-[calc((100%-32rem)/2)] md:border-x">
        <DrawerHeader className="border-border shrink-0 border-b text-left">
          <DrawerTitle>{preparing ? '새 가사 가져오기' : '가사 편집'}</DrawerTitle>
          <DrawerDescription>
            {preparing
              ? '일본어 원문이나 준비된 JSON·LRC로 새 가사를 만드세요.'
              : '문장을 고치고, 비어 있는 시간만 노래에 맞춰 찍으세요.'}
          </DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 overflow-y-auto px-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
          {preparing && (
            <div data-tour="lyrics-import-mode" className="flex flex-col gap-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{importStage === 'source' ? '원문 준비' : '데이터 적용'}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {importStage === 'source'
                      ? '일본어 원문을 넣고 바로 편집을 시작하세요.'
                      : '준비한 JSON이나 표 형식 데이터를 그대로 붙여 넣으세요.'}
                  </p>
                </div>
                {lines.length > 0 && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setPreparing(false)}>
                    현재 가사로 돌아가기
                  </Button>
                )}
              </div>

              {importStage === 'source' ? (
                <section
                  key="source"
                  aria-label="원문 입력"
                  className="border-border bg-card animate-in fade-in-0 border p-3 duration-150 ease-[var(--ease-out-strong)]"
                >
                  <p className="text-muted-foreground text-xs">노래에서 부르는 줄바꿈 그대로 붙여 넣으세요.</p>
                  <div className="mt-3 grid gap-1.5">
                    <Label htmlFor="source-lyrics">일본어 원문</Label>
                    <Textarea
                      id="source-lyrics"
                      value={sourceText}
                      onChange={event => updateSourceText(event.target.value)}
                      rows={8}
                      placeholder={sourcePlaceholder}
                      className="font-utility text-sm"
                    />
                  </div>
                  <div data-tour="lyrics-import-action" className="mt-3 grid gap-2">
                    <Button type="button" onClick={prepareSourceLines} disabled={!sourceText.trim()}>
                      {sourceActionLabel}
                    </Button>
                  </div>
                  <p className="text-muted-foreground mt-2 text-xs">
                    원문으로 바로 시작하면 발음·번역과 시간은 편집 화면에서 직접 채웁니다.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="px-0"
                      onClick={() => void copyPrompt()}
                      disabled={!sourceText.trim()}
                    >
                      <Copy />
                      외부 AI 요청문 복사 (선택)
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="px-0"
                      onClick={() => setImportStage('result')}
                    >
                      이미 JSON·LRC가 있어요
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="px-0" onClick={addLine}>
                      빈 줄부터 직접 만들기
                    </Button>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    외부 AI에는 제출 권한이 있는 원문만 보내세요. 서비스 정책에 따라 처리가 거절될 수 있습니다.
                  </p>
                  {promptCopyError && (
                    <p role="alert" className="text-destructive mt-2 text-xs">
                      {promptCopyError}
                    </p>
                  )}
                </section>
              ) : (
                <section
                  key="result"
                  aria-label="데이터 적용 단계"
                  className="border-border bg-accent/35 animate-in fade-in-0 border p-3 duration-150 ease-[var(--ease-out-strong)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <Braces className="text-primary size-4" />
                        JSON·LRC 붙여넣기
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        JSON 배열, [분:초] LRC, 시간 · 원문 · 발음 · 번역 순서의 표 데이터를 붙여 넣으세요.
                      </p>
                    </div>
                    {sourceLineCount > 0 && (
                      <span className="font-utility text-muted-foreground shrink-0 text-xs">
                        원문 {sourceLineCount}줄
                      </span>
                    )}
                  </div>

                  {promptStatus && (
                    <p
                      role={promptStatusRole}
                      className={promptCopyError ? 'text-destructive mt-3 text-xs' : 'text-primary mt-3 text-xs'}
                    >
                      {promptStatus}
                    </p>
                  )}
                  <div className="mt-3 grid gap-1.5">
                    <Label htmlFor="ai-result">JSON · LRC 데이터</Label>
                    <Textarea
                      id="ai-result"
                      value={resultText}
                      onChange={event => updateResultText(event.target.value)}
                      rows={9}
                      placeholder={resultPlaceholder}
                      className="font-utility text-sm"
                    />
                  </div>
                  <Button type="button" className="mt-3 w-full" onClick={prepareLines} disabled={!resultText.trim()}>
                    {preparationActionLabel}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2 px-0"
                    onClick={() => setImportStage('source')}
                  >
                    원문 입력으로 돌아가기
                  </Button>
                  {preparationError && (
                    <p role="alert" className="text-destructive mt-2 text-center text-xs">
                      {preparationError}
                    </p>
                  )}
                </section>
              )}
            </div>
          )}

          {!preparing &&
            (activeLine ? (
              <div className="flex flex-col gap-4 py-4">
                <section
                  ref={syncStepRef}
                  tabIndex={-1}
                  aria-labelledby="sync-step-heading"
                  data-tour="lyrics-edit-summary"
                  className="border-border bg-card flex scroll-mt-3 items-start justify-between gap-3 border p-3 outline-none"
                >
                  <div>
                    <p id="sync-step-heading" className="text-sm font-medium">
                      현재 가사 · {lines.length}줄
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">{preparationSummary}</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={openImport}>
                    새 가사로 교체
                  </Button>
                </section>

                <section
                  aria-label="재생 위치 맞추기"
                  data-tour="lyrics-time-editor"
                  className="border-border bg-card border"
                >
                  <div className="border-border border-b px-3 py-4 text-center">
                    <p className="font-utility text-muted-foreground text-[0.65rem] font-semibold tracking-[0.12em]">
                      지금 맞출 줄
                    </p>
                    <p lang="ja" className="font-japanese mt-1 text-lg font-semibold">
                      {activeLine.jp || '일본어 가사를 입력하세요'}
                    </p>
                  </div>
                  <div className="border-border flex items-center gap-1 border-b p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="font-utility h-11 flex-1 rounded-none"
                      onClick={() => onSeek(Math.max(0, time - 5))}
                    >
                      −5s
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11 rounded-none"
                      aria-label={isPlaying ? '편집 중 일시정지' : '편집 중 재생'}
                      onClick={onTogglePlay}
                    >
                      {isPlaying ? (
                        <Pause className="fill-current" />
                      ) : (
                        <Play className="translate-x-0.5 fill-current" />
                      )}
                    </Button>
                    <span className="font-utility text-primary min-w-14 text-center text-sm font-semibold tabular-nums">
                      {formatTime(time)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      className="font-utility h-11 flex-1 rounded-none"
                      onClick={() => onSeek(duration > 0 ? Math.min(duration, time + 5) : time + 5)}
                    >
                      +5s
                    </Button>
                  </div>
                  <input
                    type="range"
                    aria-label="편집 재생 위치"
                    className="karaoke-progress h-11 w-full cursor-pointer px-3"
                    min={0}
                    max={duration > 0 ? duration : 1}
                    step={0.1}
                    disabled={duration <= 0}
                    value={duration > 0 ? Math.min(time, duration) : 0}
                    onChange={event => onSeek(Number(event.target.value))}
                  />
                  <Button type="button" size="lg" className="w-full rounded-none" onClick={stamp}>
                    <Timer />
                    지금 이 줄 시작 · {time.toFixed(1)}초
                  </Button>
                </section>

                <section aria-labelledby="active-line-heading" className="grid gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p id="active-line-heading" className="font-utility text-primary text-xs font-semibold">
                        LINE {String(activeIndex + 1).padStart(2, '0')} / {String(lines.length).padStart(2, '0')}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {stampedCount}/{lines.length}줄의 시점을 찍었습니다.
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveIndex(index => Math.max(0, index - 1))}
                        disabled={activeIndex === 0}
                      >
                        이전
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveIndex(index => Math.min(lines.length - 1, index + 1))}
                        disabled={activeIndex === lines.length - 1}
                      >
                        다음
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="line-japanese">일본어</Label>
                    <Textarea
                      id="line-japanese"
                      lang="ja"
                      rows={2}
                      value={activeLine.jp}
                      onChange={event => updateActiveLine({ jp: event.target.value })}
                      className="font-japanese text-lg"
                      placeholder="日本語の歌詞"
                    />
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor="line-pronunciation">한글 발음</Label>
                      <Input
                        id="line-pronunciation"
                        value={activeLine.pron}
                        onChange={event => updateActiveLine({ pron: event.target.value })}
                        placeholder="니혼고노 카시"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="line-translation">한국어 번역</Label>
                      <Input
                        id="line-translation"
                        value={activeLine.ko}
                        onChange={event => updateActiveLine({ ko: event.target.value })}
                        placeholder="일본어 가사"
                      />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="line-time">시작 시간 (초)</Label>
                    <Input
                      id="line-time"
                      type="number"
                      min={0}
                      step={0.1}
                      value={activeLine.time ?? ''}
                      onChange={event => {
                        const nextTime = event.target.value === '' ? null : Number(event.target.value);
                        updateActiveLine({ time: Number.isFinite(nextTime) ? nextTime : null });
                      }}
                      placeholder="위의 ‘지금 이 줄 시작’으로 입력"
                      className="font-utility"
                    />
                  </div>
                </section>

                <section aria-label="전체 가사 줄" className="border-border border">
                  <div className="border-border flex items-center justify-between border-b px-3 py-2">
                    <p className="text-sm font-medium">전체 줄</p>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="현재 줄 다음에 추가"
                        onClick={addLine}
                      >
                        <Plus />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="현재 줄 삭제"
                        onClick={removeLine}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                  <ol className="max-h-48 overflow-y-auto">
                    {lines.map((line, index) => (
                      <li key={index}>
                        <button
                          type="button"
                          aria-current={index === activeIndex ? 'true' : undefined}
                          className="border-border aria-current:bg-accent/60 grid min-h-11 w-full grid-cols-[3.5rem_1fr] items-center gap-2 border-b px-3 text-left last:border-b-0"
                          onClick={() => setActiveIndex(index)}
                        >
                          <span className="font-utility text-muted-foreground text-xs tabular-nums">
                            {line.time === null ? '--:--' : formatTime(line.time)}
                          </span>
                          <span className="truncate text-sm" lang="ja">
                            {line.jp || '빈 줄'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </section>

                <div data-tour="lyrics-save" className="grid grid-cols-[1fr_auto] gap-2">
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => void save()}
                    disabled={!done || saveState === 'saving'}
                  >
                    {saveState === 'saved' ? <Check /> : <Save />}
                    {saveState === 'saving' ? '저장 중' : saveState === 'saved' ? '저장됨' : '이 기기에 저장'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-11"
                    aria-label="JSON 백업 복사"
                    onClick={() => void copyBackup()}
                    disabled={!done}
                  >
                    {copied === 'backup' ? <Check /> : <Copy />}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <p className="text-sm font-medium">아직 편집할 줄이 없습니다.</p>
                <p className="text-muted-foreground text-xs">가사를 붙여 넣거나 직접 첫 줄을 추가하세요.</p>
                <Button type="button" variant="outline" onClick={addLine}>
                  <Plus />
                  직접 한 줄 추가
                </Button>
              </div>
            ))}

          {saveState === 'saved' && (
            <p role="status" className="text-muted-foreground pb-2 text-center text-xs">
              이 기기에 저장했습니다.
            </p>
          )}
          {saveState === 'error' && (
            <p role="alert" className="text-destructive pb-2 text-center text-xs">
              {saveError}
            </p>
          )}
          {copied === 'backup' && (
            <p role="status" className="text-muted-foreground pb-2 text-center text-xs">
              JSON을 클립보드에 복사했습니다.
            </p>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
