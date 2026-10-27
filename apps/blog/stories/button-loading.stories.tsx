import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';

import { Button } from '@mumak/ui/components/button';
import { LoadingButton } from '@mumak/ui/components/loading-button';
import { cn } from '@mumak/ui/lib/utils';

import { LabPage } from './lab-page';

const candidates = ['text', 'labeledSpinner', 'spinner'] as const;
type Candidate = (typeof candidates)[number];
type Phase = 'idle' | 'loading' | 'success' | 'failure';
type Attempt = { phase: Phase; count: number };

function LoadingCandidate({
  candidate,
  attempt,
  onStart,
}: {
  candidate: Candidate;
  attempt: Attempt;
  onStart: () => void;
}) {
  const t = useTranslations('buttonLoadingLab');
  const id = useId();
  const loading = attempt.phase === 'loading';
  const spinner = <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />;

  return (
    <section aria-labelledby={`${id}-title`} className="min-w-0 space-y-5 rounded-xl border border-border p-5">
      <header className="space-y-2">
        <h2 id={`${id}-title`} className="text-lg font-semibold">
          {t(`${candidate}Title`)}
        </h2>
        <p className="text-sm leading-relaxed lg:min-h-20">{t(`${candidate}Description`)}</p>
      </header>
      <div className="flex min-h-20 items-center">
        {candidate === 'spinner' ? (
          <LoadingButton type="button" loading={loading} loadingLabel={t('saving')} onClick={onStart}>
            {t('save')}
          </LoadingButton>
        ) : (
          <Button
            type="button"
            aria-busy={loading}
            aria-disabled={loading}
            onClick={onStart}
            className={cn('relative', loading && 'cursor-wait')}
          >
            {loading && candidate === 'labeledSpinner' && spinner}
            {t(loading ? 'saving' : 'save')}
          </Button>
        )}
      </div>
      <p role="status" aria-atomic="true" className="min-h-12 text-sm leading-relaxed">
        {attempt.phase !== 'idle' && (
          <>
            <span className="sr-only">{t(`${candidate}Title`)}: </span>
            {t(`${attempt.phase}Status`)}
          </>
        )}
      </p>
      <p className="text-sm text-muted-foreground tabular-nums">{t('count', { count: attempt.count })}</p>
    </section>
  );
}

function ButtonLoading() {
  const t = useTranslations('buttonLoadingLab');
  const [delay, setDelay] = useState(1800);
  const [outcome, setOutcome] = useState<'success' | 'failure'>('success');
  const [attempts, setAttempts] = useState<Record<Candidate, Attempt>>({
    text: { phase: 'idle', count: 0 },
    labeledSpinner: { phase: 'idle', count: 0 },
    spinner: { phase: 'idle', count: 0 },
  });
  // Lock synchronously: repeated clicks can arrive before React commits the pending UI.
  const pending = useRef(new Map<Candidate, ReturnType<typeof setTimeout>>());
  const busy = candidates.some(candidate => attempts[candidate].phase === 'loading');

  useEffect(() => {
    const timers = pending.current;
    return () => {
      timers.forEach(timer => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  function start(candidate: Candidate) {
    if (pending.current.has(candidate)) return;
    pending.current.set(
      candidate,
      setTimeout(() => {
        pending.current.delete(candidate);
        setAttempts(previous => ({ ...previous, [candidate]: { ...previous[candidate], phase: outcome } }));
      }, delay)
    );
    setAttempts(previous => ({
      ...previous,
      [candidate]: { phase: 'loading', count: previous[candidate].count + 1 },
    }));
  }

  return (
    <LabPage title={t('title')} description={t('intro')}>
      <p className="text-sm leading-relaxed">{t('context')}</p>
      <fieldset disabled={busy} className="flex flex-wrap items-end gap-4 rounded-xl bg-muted p-5">
        <legend className="sr-only">{t('conditions')}</legend>
        <label className="flex flex-col gap-2 text-sm font-medium">
          {t('delay')}
          <select
            className="rounded-md border border-border bg-background px-3 py-2 disabled:opacity-50"
            value={delay}
            onChange={event => setDelay(Number(event.target.value))}
          >
            <option value={300}>{t('fast')}</option>
            <option value={1800}>{t('normal')}</option>
            <option value={5000}>{t('slow')}</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          {t('outcome')}
          <select
            className="rounded-md border border-border bg-background px-3 py-2 disabled:opacity-50"
            value={outcome}
            onChange={event => setOutcome(event.target.value === 'failure' ? 'failure' : 'success')}
          >
            <option value="success">{t('success')}</option>
            <option value="failure">{t('failure')}</option>
          </select>
        </label>
        <Button type="button" variant="outline" onClick={() => candidates.forEach(start)}>
          {t('startAll')}
        </Button>
      </fieldset>
      <div className="grid gap-4 lg:grid-cols-3">
        {candidates.map(candidate => (
          <LoadingCandidate
            key={candidate}
            candidate={candidate}
            attempt={attempts[candidate]}
            onStart={() => start(candidate)}
          />
        ))}
      </div>
      <section aria-labelledby="loading-observe" className="space-y-3 text-sm leading-relaxed">
        <h2 id="loading-observe" className="text-lg font-semibold">
          {t('observeTitle')}
        </h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>{t('observeFeedback')}</li>
          <li>{t('observeWidth')}</li>
          <li>{t('observeInput')}</li>
          <li>{t('observeOutcome')}</li>
        </ol>
        <p>{t('common')}</p>
        <p>{t('motion')}</p>
        <p className="font-medium">{t('question')}</p>
      </section>
    </LabPage>
  );
}

const meta = {
  title: 'Learning/Button loading',
  component: ButtonLoading,
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof ButtonLoading>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Compare: Story = {};
