import type { CodeProblem } from '@/lib/curriculum';
import type { Progress } from '@/lib/progress';
import { saveProgress } from '@/lib/progress-store';

export function ExplanationNotes({ problem, progress }: { problem: CodeProblem; progress: Progress }) {
  const key = `${problem.id}:plan`;
  return (
    <section className="mt-7 rounded-2xl border bg-white p-5 sm:p-6" aria-label="설명 연습">
      <h2 className="text-base font-bold">먼저 설명하고, 그다음 구현하기</h2>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">
        이동 중에는 한 단계만 말로 풀어봐요. 5분: 요구사항 · 10분: 예시 추적 · 15분: 구현 계획. 전체 구현은 약{' '}
        {problem.minutes}분을 잡고 이어서 진행하세요.
      </p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6">
        {problem.steps.map(step => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <label htmlFor="plan-notes" className="mt-5 block text-sm font-semibold">
        화이트보드 메모
      </label>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        입력 예시 → 노드·포인터 / 상태 변화 → 불변식 → 시간·공간 비용 → 실패 조건을 적어 보세요. 예: head → A ⇄ B →
        null. 코드와 함께 기기 간 저장됩니다.
      </p>
      <textarea
        id="plan-notes"
        value={progress.notes[key] ?? ''}
        maxLength={6000}
        onChange={event => saveProgress(p => ({ ...p, notes: { ...p.notes, [key]: event.target.value } }))}
        placeholder="먼저 확인할 조건과 그림을 나의 말로…"
        className="mt-3 min-h-40 w-full resize-y rounded-xl border bg-background p-4 font-mono text-base leading-7 sm:text-sm"
      />
      {problem.diagram && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold">막혔다면 예시 그림 보기</summary>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-background p-4 text-xs leading-6">{problem.diagram}</pre>
        </details>
      )}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-semibold">면접관의 추가 질문</summary>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6">
          {problem.followups.map(question => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
