import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';

import { Button } from '@mumak/ui/components/button';
import { cn } from '@mumak/ui/lib/utils';

import { Link } from '@/src/shared/config/i18n';
import { ContentCard } from '@/src/shared/ui/content-card';
import { PageHeader } from '@/src/shared/ui/page-header';

import './focus-comparison.css';

function FocusExamples({ candidate }: { candidate: boolean }) {
  const t = useTranslations('focusLab');
  const titleId = useId();
  const [message, setMessage] = useState('');

  return (
    <section
      aria-labelledby={titleId}
      data-focus-candidate={candidate || undefined}
      data-focus-baseline={!candidate || undefined}
      className="min-w-0 space-y-6 rounded-xl border border-border p-6"
      onClickCapture={event => {
        if (event.target instanceof Element && event.target.closest('a')) {
          event.preventDefault();
          setMessage(t('linkActivated'));
        }
      }}
    >
      <header className="space-y-2">
        <h2 id={titleId} className="text-xl font-semibold">
          {t(candidate ? 'candidate' : 'current')}
        </h2>
        <p className="text-sm text-muted-foreground">{t(candidate ? 'candidateDescription' : 'currentDescription')}</p>
      </header>
      <div className="flex flex-wrap gap-4">
        <Button onClick={() => setMessage(t('saved'))}>{t('save')}</Button>
        <Button variant="outline" onClick={() => setMessage(t('cancelled'))}>
          {t('cancel')}
        </Button>
        <Button disabled>{t('disabled')}</Button>
      </div>
      <ContentCard
        href="/blog"
        title={t('cardTitle')}
        meta={t('cardMeta')}
        description={t('cardDescription')}
        tags={
          <Link href="/blog/tags" className="rounded-sm text-sm text-muted-foreground underline underline-offset-4">
            {t('tag')}
          </Link>
        }
      />
      <p role="status" className="min-h-6 text-sm text-muted-foreground">
        {message}
      </p>
    </section>
  );
}

function FocusComparison() {
  const t = useTranslations('focusLab');
  const [surface, setSurface] = useState('background');
  const start = useRef<HTMLDivElement>(null);
  const controlsId = useId();

  return (
    <main className="min-h-screen bg-background px-5 py-10 text-foreground sm:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <PageHeader title={t('title')} description={t('introduction')} />
        <div className="flex flex-wrap items-end gap-5">
          <label className="flex flex-col gap-2 text-sm font-medium">
            <span id={`${controlsId}-surface`}>{t('surface')}</span>
            <select
              aria-labelledby={`${controlsId}-surface`}
              className="rounded-md border border-border bg-background px-3 py-2"
              value={surface}
              onChange={event => setSurface(event.target.value)}
            >
              <option value="background">{t('background')}</option>
              <option value="muted">{t('muted')}</option>
            </select>
          </label>
          <Button variant="outline" onClick={() => start.current?.focus()}>
            {t('start')}
          </Button>
        </div>
        <div ref={start} tabIndex={-1} className="rounded-md text-sm leading-relaxed">
          <p>{t('instructions')}</p>
          <p className="text-muted-foreground">{t('activationNote')}</p>
        </div>
        <div
          className={cn('grid gap-6 rounded-xl p-4 lg:grid-cols-2', surface === 'muted' ? 'bg-muted' : 'bg-background')}
        >
          <FocusExamples candidate={false} />
          <FocusExamples candidate />
        </div>
        <aside className="space-y-2 text-sm text-muted-foreground">
          <p>{t('candidateNote')}</p>
          <p>{t('question')}</p>
        </aside>
      </div>
    </main>
  );
}

const meta = {
  title: 'Learning/Focus comparison',
  component: FocusComparison,
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof FocusComparison>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Compare: Story = {};
