import { ArrowLeft, ArrowUpRight, Check, Mic, Pause, Play, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@mumak/ui/components/button';

import { SectionTitle } from '@/components/ui';
import { stories, storySections } from '@/lib/curriculum';
import type { Progress } from '@/lib/progress';
import { saveProgress } from '@/lib/progress-store';

function SpeakingTimer() {
  const [remaining, setRemaining] = useState(120);
  const [deadline, setDeadline] = useState<number | null>(null);
  useEffect(() => {
    if (deadline === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (!left) setDeadline(null);
    };
    const interval = window.setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [deadline]);
  return (
    <div className="mb-7 rounded-2xl bg-[#172b4d] p-5 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Mic aria-hidden className="size-5 text-[#f3b760]" />
          <div>
            <p className="text-sm font-semibold">두 정거장 분량으로 이야기해요</p>
            <p className="mt-1 text-xs text-[#b9c9ee]">2분 스피치 · 녹음 없이 타이머만 사용</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span role="timer" className="font-mono text-xl tabular-nums">
            {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
          </span>
          <button
            onClick={() => {
              if (deadline) {
                setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
                setDeadline(null);
              } else if (remaining) setDeadline(Date.now() + remaining * 1000);
            }}
            disabled={!remaining}
            className="grid size-11 place-items-center rounded-lg hover:bg-white/10"
            aria-label={deadline ? '스피치 일시정지' : '스피치 시작'}
          >
            {deadline ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <button
            onClick={() => {
              setDeadline(null);
              setRemaining(120);
            }}
            className="grid size-11 place-items-center rounded-lg hover:bg-white/10"
            aria-label="스피치 타이머 초기화"
          >
            <RotateCcw className="size-4" />
          </button>
        </div>
      </div>
      {!remaining && (
        <p role="status" className="mt-3 text-sm text-[#f3b760]">
          2분이 지났어요. 핵심 선택과 결과가 잘 전달됐나요?
        </p>
      )}
    </div>
  );
}

export function StoryNotes({ progress }: { progress: Progress }) {
  const [active, setActive] = useState<string | null>(null);
  const story = stories.find(s => s.id === active);
  if (!story)
    return (
      <>
        <SectionTitle eyebrow="내 언어로 설명하기" title="경험을 이야기로" />
        <p className="-mt-3 mb-8 max-w-xl text-sm leading-7 text-muted-foreground">
          좋은 답변은 거창한 성과보다, 내가 왜 그렇게 선택했는지에서 시작해요. 회사의 비밀이나 개인정보 대신 나의 판단을
          적어 두세요.
        </p>
        <div className="space-y-3">
          {stories.map((s, i) => {
            const count = storySections.filter((_, j) => progress.notes[`${s.id}:${j}`]?.trim()).length;
            return (
              <button
                onClick={() => setActive(s.id)}
                key={s.id}
                className="flex w-full items-center gap-4 rounded-2xl border bg-white p-5 text-left hover:border-primary/40"
              >
                <span className="text-2xl font-light text-[#aebbd1]">{String(i + 1).padStart(2, '0')}</span>
                <div className="flex-1">
                  <p className="text-[11px] text-muted-foreground">{s.subtitle}</p>
                  <h2 className="mt-1 font-semibold">{s.title}</h2>
                  <p className="mt-2 text-xs text-primary">
                    {count ? `${count} / 5단계 작성` : '아직 쓰지 않은 이야기'}
                  </p>
                </div>
                <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden />
              </button>
            );
          })}
        </div>
      </>
    );
  return (
    <div>
      <Button variant="ghost" onClick={() => setActive(null)} className="mb-7 -ml-3 h-11">
        <ArrowLeft aria-hidden />
        이야기 목록
      </Button>
      <p className="mb-4 text-xs font-semibold text-primary">{story.subtitle}</p>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{story.title}</h1>
      <p className="mt-4 mb-7 text-sm leading-7 text-muted-foreground">{story.prompt}</p>
      <SpeakingTimer />
      <div className="space-y-6">
        {storySections.map((section, i) => (
          <div key={section}>
            <label htmlFor={`note-${i}`} className="mb-3 flex items-center justify-between text-sm font-semibold">
              <span>
                <span className="mr-2 text-primary">0{i + 1}</span>
                {section}
              </span>
              {progress.notes[`${story.id}:${i}`]?.trim() && (
                <Check aria-label="작성됨" className="size-4 text-[#386e54]" />
              )}
            </label>
            <textarea
              id={`note-${i}`}
              maxLength={10000}
              value={progress.notes[`${story.id}:${i}`] ?? ''}
              onChange={e => saveProgress(p => ({ ...p, notes: { ...p.notes, [`${story.id}:${i}`]: e.target.value } }))}
              placeholder={
                [
                  '어떤 사용자의 어떤 문제가 있었나요?',
                  '직접 맡은 범위와 결정한 이유를 적어 보세요.',
                  '고려한 다른 방법과 선택으로 감수한 비용은?',
                  '측정 조건, 실제 수치, 확인한 테스트를 구분해요.',
                  '지금 다시 한다면 달라질 판단 한 가지는?',
                ][i]
              }
              className="min-h-32 w-full rounded-xl border bg-white p-4 text-base leading-7 sm:text-sm placeholder:text-muted-foreground/70"
            />
          </div>
        ))}
      </div>
      <section className="mt-8 rounded-2xl border p-5">
        <h2 className="mb-3 text-sm font-bold">한 걸음 더 깊게</h2>
        <ul className="space-y-3">
          {story.probes.map(probe => (
            <li key={probe} className="flex gap-2 text-sm leading-6 text-muted-foreground">
              <span className="text-primary">—</span>
              {probe}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
