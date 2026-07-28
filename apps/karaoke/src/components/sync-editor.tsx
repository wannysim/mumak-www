import { Check, Copy, Timer, Undo2 } from 'lucide-react';
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

function parseLine(raw: string, time: number): LyricLine {
  const [jp = '', pron = '', ko = ''] = raw.split('|').map(part => part.trim());
  return { time, jp, pron, ko };
}

/**
 * 가사 타임스탬프 제작 도구. 노래를 틀어 두고 줄이 시작될 때마다 "지금" 버튼을
 * 눌러 시간을 찍은 뒤, 완성된 JSON을 public/lyrics/<slug>.json으로 저장한다.
 */
export function SyncEditor({ time }: { time: number }) {
  const [text, setText] = React.useState('');
  const [stamps, setStamps] = React.useState<number[]>([]);
  const [copied, setCopied] = React.useState(false);

  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const nextIndex = stamps.length;
  const done = lines.length > 0 && nextIndex >= lines.length;

  const stamp = () => {
    if (done) return;
    setStamps(prev => [...prev, Math.round(time * 10) / 10]);
  };

  const copy = async () => {
    const result = lines.map((line, index) => parseLine(line, stamps[index] ?? 0));
    await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="싱크 편집 모드" className="size-11">
          <Timer className="size-5" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>싱크 편집</DrawerTitle>
          <DrawerDescription>한 줄에 「日本語 | 발음 | 번역」. 노래를 들으며 줄 시작마다 눌러요.</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-3 px-4 pb-8">
          <Textarea
            value={text}
            onChange={event => {
              setText(event.target.value);
              setStamps([]);
            }}
            rows={5}
            placeholder={'君を握った | 키미오 니깃타 | 너를 붙잡았어\n...'}
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
                  onClick={() => setStamps(prev => prev.slice(0, -1))}
                  disabled={nextIndex === 0}
                >
                  <Undo2 />
                </Button>
                <Button type="button" variant="outline" size="icon" aria-label="JSON 복사" onClick={copy}>
                  {copied ? <Check /> : <Copy />}
                </Button>
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
