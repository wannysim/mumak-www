import { ArrowLeft, ArrowRight, Bookmark, Check, Clock3, Pause, Play } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@mumak/ui/components/button';

import type { Question } from '@/lib/curriculum';
import { recordAttempt, remainingSeconds, type Progress } from '@/lib/progress';
import { saveProgress } from '@/lib/progress-store';

export function QuestionPractice({
  question,
  progress,
  back,
  next,
}: {
  question: Question;
  progress: Progress;
  back: () => void;
  next: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const session = progress.session;
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const interval = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  const seconds = session ? remainingSeconds(session, now) : 0;
  const saved = progress.review.includes(question.id);
  function check() {
    if (selected === null || checked) return;
    setChecked(true);
    saveProgress(p => recordAttempt(p, question.id, selected === question.answer));
  }
  function pause() {
    saveProgress(p =>
      p.session
        ? {
            ...p,
            session: {
              ...p.session,
              remaining: remainingSeconds(p.session, Date.now()),
              deadline: p.session.deadline ? null : Date.now() + remainingSeconds(p.session, Date.now()) * 1000,
            },
          }
        : p
    );
    setNow(Date.now());
  }
  return (
    <div>
      <div className="mb-8 flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={back} className="-ml-3 h-11">
          <ArrowLeft aria-hidden />
          문제 목록
        </Button>
        <button
          aria-pressed={saved}
          onClick={() =>
            saveProgress(p => ({
              ...p,
              review: saved ? p.review.filter(id => id !== question.id) : [...p.review, question.id],
            }))
          }
          className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs text-primary"
        >
          <Bookmark className={`size-4 ${saved ? 'fill-primary' : ''}`} aria-hidden />
          {saved ? '저장됨' : '다시 보기'}
        </button>
      </div>
      {session && (
        <div className="mb-7 rounded-xl border bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Clock3 className="size-4 text-primary" aria-hidden />
              {seconds === 0 ? '오늘의 집중 시간 완료' : `${session.minutes}분 여정`}
              <span className="font-mono text-primary tabular-nums">
                {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
              </span>
            </p>
            <div className="flex items-center">
              {seconds > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={pause}
                  aria-label={session.deadline ? '타이머 일시정지' : '타이머 계속'}
                  className="size-11"
                >
                  {session.deadline ? <Pause /> : <Play />}
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => saveProgress(p => ({ ...p, session: null }))}
                className="h-11 text-xs"
              >
                연습 마치기
              </Button>
            </div>
          </div>
          {seconds === 0 && (
            <p role="status" className="mt-2 text-xs leading-5 text-muted-foreground">
              수고했어요. 지금 문제를 마저 풀거나 편하게 쉬어도 좋아요.
            </p>
          )}
        </div>
      )}
      <p className="mb-4 text-xs font-semibold tracking-wide text-primary">
        {question.topic} · 코드 읽기 · 약 {question.minutes}분
      </p>
      <h1 className="text-2xl leading-snug font-bold tracking-tight sm:text-3xl">{question.title}</h1>
      <p className="mt-4 mb-6 text-sm leading-7 text-muted-foreground">{question.prompt}</p>
      {question.code && (
        <pre className="mb-7 overflow-x-auto whitespace-pre-wrap break-words rounded-2xl bg-[#172b4d] p-5 font-mono text-[13px] leading-7 text-[#e6edfc] sm:p-7">
          <code>{question.code}</code>
        </pre>
      )}
      <fieldset disabled={checked}>
        <legend className="mb-3 text-sm font-semibold">생각한 답을 골라 주세요</legend>
        <div className="space-y-3">
          {question.choices.map((choice, i) => (
            <label
              key={choice}
              className={`flex min-h-15 cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm leading-6 transition-colors ${checked && i === question.answer ? 'border-[#91b6a2] bg-[#e7f1ec]' : selected === i ? 'border-primary bg-[#e8edff]' : 'bg-white hover:border-primary/40'}`}
            >
              <input
                type="radio"
                name="answer"
                value={i}
                checked={selected === i}
                onChange={() => setSelected(i)}
                className="size-4 shrink-0 accent-[#375beb]"
              />
              <span className="flex-1">{choice}</span>
              {checked && i === question.answer && <Check className="size-4 text-[#386e54]" aria-label="정답" />}
            </label>
          ))}
        </div>
      </fieldset>
      {checked && (
        <section role="status" className="mt-7 rounded-2xl border bg-white p-6">
          <p className={`mb-3 text-lg font-bold ${selected === question.answer ? 'text-[#386e54]' : 'text-primary'}`}>
            {selected === question.answer ? '좋아요, 한 걸음 더.' : '이 문제, 다시 만나봐요.'}
          </p>
          <p className="text-sm leading-7">{question.explanation}</p>
          <div className="mt-5 border-t pt-5">
            <h2 className="mb-2 text-xs font-bold text-primary">면접관이 한 번 더 묻는다면</h2>
            <p className="text-sm leading-6 text-muted-foreground">{question.followup}</p>
          </div>
        </section>
      )}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] mt-7 border-t bg-background/95 py-4 backdrop-blur-sm lg:bottom-0">
        {checked ? (
          <Button onClick={next} className="h-13 w-full rounded-xl text-base">
            다음 문제로
            <ArrowRight aria-hidden />
          </Button>
        ) : (
          <Button disabled={selected === null} onClick={check} className="h-13 w-full rounded-xl text-base">
            답 확인하기
          </Button>
        )}
      </div>
    </div>
  );
}
