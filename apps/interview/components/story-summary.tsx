import { useEffect, useRef, useState } from 'react';

import { Button } from '@mumak/ui/components/button';

import { storySections } from '@/lib/curriculum';
import type { Progress } from '@/lib/progress';
import { saveProgress } from '@/lib/progress-store';

export function StorySummary({ id, notes }: { id: string; notes: Progress['notes'] }) {
  const noteKey = id + ':summary';
  const saved = notes[noteKey] ?? '';
  const input = storySections
    .flatMap((section, i) => {
      const value = notes[id + ':' + i]?.trim();
      return value ? [section + '\n' + value] : [];
    })
    .join('\n\n');
  const [proposal, setProposal] = useState<{ source: string; text: string; previous: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function generate() {
    if (!input || controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/story-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: input,
        signal: abort.signal,
      });
      if (!response.ok)
        throw Error(
          response.status === 503
            ? '요약 기능의 서버 설정이 필요해요.'
            : response.status === 429
              ? 'API 사용 한도를 확인한 뒤 다시 시도해 주세요.'
              : '요약을 가져오지 못했어요. 다시 시도해 주세요.'
        );
      const { summary } = await response.json();
      if (typeof summary !== 'string' || !summary.trim()) throw Error('요약이 비어 있어요. 다시 시도해 주세요.');
      setProposal({ source: input, text: summary, previous: saved });
    } catch (e) {
      if (!abort.signal.aborted) setError(e instanceof Error ? e.message : '요약을 가져오지 못했어요.');
    } finally {
      controller.current = null;
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  const stale = proposal && (proposal.source !== input || proposal.previous !== saved);
  return (
    <section className="mt-8 rounded-xl border bg-card p-5">
      <h2 className="font-semibold">내 답변 한 줄 요약</h2>
      <p className="my-3 text-sm">버튼을 누르면 이 이야기에서 작성한 답변을 OpenAI로 보내요.</p>
      {saved && <p className="mb-3">{saved}</p>}
      <Button variant="outline" disabled={!input || busy} onClick={generate}>
        {busy ? '요약하는 중…' : '한 문장으로 줄이기'}
      </Button>
      {error && <p role="alert">{error}</p>}
      {proposal && (
        <div className="mt-4 space-y-2">
          <label htmlFor="summary-draft">요약 초안</label>
          <textarea
            id="summary-draft"
            className="w-full rounded-lg border border-input p-3"
            value={proposal.text}
            maxLength={10000}
            onChange={e => setProposal({ ...proposal, text: e.target.value })}
          />
          {stale && <p role="status">답변이나 저장된 요약이 바뀌었어요. 다시 요약해 주세요.</p>}
          <Button
            disabled={!!stale || busy || !proposal.text.trim()}
            onClick={() => {
              if (saveProgress(p => ({ ...p, notes: { ...p.notes, [noteKey]: proposal.text.trim() } })))
                setProposal(null);
            }}
          >
            요약 저장
          </Button>
        </div>
      )}
    </section>
  );
}
