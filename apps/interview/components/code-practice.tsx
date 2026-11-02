import { ArrowLeft, CheckCircle2, ChevronDown, Play, RotateCcw, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@mumak/ui/components/button';

import { ExplanationNotes } from '@/components/explanation-notes';
import { ReviewToggle } from '@/components/review-toggle';
import { runCode, type RunResult } from '@/lib/code-runner';
import type { CodeProblem } from '@/lib/curriculum';
import { recordAttempt, type Progress } from '@/lib/progress';
import { saveProgress } from '@/lib/progress-store';

export function CodePractice({
  problem,
  progress,
  back,
}: {
  problem: CodeProblem;
  progress: Progress;
  back: () => void;
}) {
  const code = progress.drafts[problem.id] ?? problem.starter;
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [executedCode, setExecutedCode] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function execute() {
    if (running) return;
    setRunning(true);
    setResult(null);
    setExecutedCode(code);
    const abort = new AbortController();
    controller.current = abort;
    const outcome = await runCode(code, problem.tests, abort.signal);
    if (abort.signal.aborted) return;
    setResult(outcome);
    setRunning(false);
    const correct =
      !outcome.error && outcome.results.length === problem.tests.length && outcome.results.every(r => r.passed);
    saveProgress(p => recordAttempt(p, problem.id, correct));
  }
  return (
    <div>
      <div className="mb-7 flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={back} className="-ml-3 h-11">
          <ArrowLeft aria-hidden />
          문제 목록
        </Button>
        <ReviewToggle id={problem.id} progress={progress} />
      </div>
      <p className="mb-4 text-xs font-semibold text-[#95601f]">
        {problem.category} · {problem.difficulty} · 약 {problem.minutes}분
      </p>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{problem.title}</h1>
      <p className="mt-4 text-sm leading-7 text-muted-foreground">{problem.description}</p>
      <p className="mt-4 rounded-xl border bg-white p-4 text-xs leading-6">{problem.contract}</p>
      <ExplanationNotes problem={problem} progress={progress} />
      <details className="mt-5 rounded-xl border bg-white p-5">
        <summary className="cursor-pointer text-sm font-semibold">입출력 예시 · {problem.tests.length}개</summary>
        <div className="mt-4 space-y-4">
          {problem.tests.map(test => (
            <div key={test.label}>
              <p className="text-xs font-semibold">{test.label}</p>
              <pre className="mt-2 overflow-x-auto text-xs leading-6">{`입력: ${JSON.stringify(test.args)}\n결과: ${JSON.stringify(test.expected)}`}</pre>
            </div>
          ))}
        </div>
      </details>
      <div className="mt-7 overflow-hidden rounded-2xl border border-[#172b4d]">
        <div className="flex items-center justify-between bg-[#203655] px-4 py-3 text-[#c3cee1]">
          <label htmlFor="code-editor" className="font-mono text-xs">
            solution.js
          </label>
          <span className="text-[11px]">{progress.drafts[problem.id] !== undefined ? '기기 초안' : '시작 코드'}</span>
        </div>
        <textarea
          id="code-editor"
          aria-label="JavaScript 코드"
          value={code}
          onChange={e => saveProgress(p => ({ ...p, drafts: { ...p.drafts, [problem.id]: e.target.value } }))}
          maxLength={20000}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="block min-h-72 w-full resize-y bg-[#172b4d] p-5 font-mono text-base leading-7 sm:text-sm text-[#e6edfc] outline-offset-[-4px]"
        />
      </div>
      <div className="mt-4 flex flex-wrap justify-between gap-3">
        <Button
          variant="ghost"
          className="h-12 text-xs"
          onClick={() => {
            if (window.confirm('작성 중인 코드를 시작 코드로 되돌릴까요?')) {
              saveProgress(p => ({ ...p, drafts: { ...p.drafts, [problem.id]: problem.starter } }));
              setResult(null);
            }
          }}
        >
          <RotateCcw aria-hidden />
          코드 초기화
        </Button>
        <Button onClick={execute} disabled={running} className="h-12 rounded-xl px-6">
          <Play aria-hidden className="size-4" />
          {running ? '테스트 실행 중…' : '코드 실행하기'}
        </Button>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        JavaScript 함수만 실행해요. 네트워크 접근 없이, 최대 2초 동안 테스트합니다. 테스트 통과와 별개로
        복잡도·설명·요구사항 확장까지 점검하세요.
      </p>
      <section aria-live="polite" className="mt-7">
        <h2 className="mb-3 text-sm font-bold">실행 결과</h2>
        {!result ? (
          <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            {running
              ? '코드를 확인하고 있어요…'
              : `${problem.tests.length}개의 테스트가 기다리고 있어요. 직접 실행해 보세요.`}
          </p>
        ) : (
          <div className="space-y-2">
            {code !== executedCode && (
              <p className="text-xs text-[#95601f]">코드가 바뀌었어요. 아래는 이전 실행 결과입니다.</p>
            )}
            {result.error && (
              <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
                {result.error}
              </p>
            )}
            {result.results.map(r => (
              <div key={r.label} className="flex gap-3 rounded-xl border bg-white p-4">
                {r.passed ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#386e54]" />
                ) : (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-red-700" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {r.passed ? '통과' : '실패'} · {r.label}
                  </p>
                  <p className="mt-1 text-xs leading-5 break-all text-muted-foreground">{r.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <details className="mt-7 rounded-xl border bg-white p-5">
        <summary className="cursor-pointer text-sm font-semibold">막혔을 때, 작은 힌트</summary>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">{problem.hint}</p>
      </details>
      <details className="mt-3 rounded-xl border bg-white p-5">
        <summary className="cursor-pointer text-sm font-semibold">충분히 생각한 뒤 풀이 보기</summary>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-background p-4 font-mono text-xs leading-6">
          <code>{problem.solution}</code>
        </pre>
        <p className="mt-4 text-sm leading-6">{problem.complexity}</p>
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <ChevronDown aria-hidden className="size-3" />
          시간·공간 복잡도와 실패 조건까지 말로 설명해 보세요.
        </p>
      </details>
    </div>
  );
}
