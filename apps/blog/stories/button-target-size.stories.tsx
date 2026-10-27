import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Bookmark, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

import { Button, buttonVariants } from '@mumak/ui/components/button';
import { cn } from '@mumak/ui/lib/utils';

import { LabPage } from './lab-page';

const candidates = ['current', 'larger', 'invisible'] as const;
const actions = [
  { key: 'previous', Icon: ChevronLeft },
  { key: 'save', Icon: Bookmark },
  { key: 'next', Icon: ChevronRight },
] as const;
type Action = (typeof actions)[number]['key'];

function TargetCandidate({ candidate, showTargets }: { candidate: (typeof candidates)[number]; showTargets: boolean }) {
  const t = useTranslations('buttonTargetLab');
  const id = useId();
  const [result, setResult] = useState<{ action: Action; count: number }>();
  const expanded = candidate !== 'current';
  const invisible = candidate === 'invisible';

  return (
    <section aria-labelledby={`${id}-title`} className="min-w-0 space-y-4 rounded-xl border border-border p-5">
      <header className="space-y-2">
        <h2 id={`${id}-title`} className="text-lg font-semibold">
          {t(`${candidate}Title`)}
        </h2>
        <p className="text-sm leading-relaxed lg:min-h-24">{t(`${candidate}Description`)}</p>
      </header>
      <div role="group" aria-label={t('controls')} className="flex min-h-24 items-center justify-center">
        {actions.map(({ key, Icon }) => (
          <div key={key} className="flex size-13 shrink-0 items-center justify-center">
            <Button
              type="button"
              size="icon"
              variant={invisible ? 'ghost' : 'outline'}
              aria-label={t(key)}
              className={cn(
                'relative',
                expanded && 'size-11',
                invisible && 'hover:bg-transparent dark:hover:bg-transparent'
              )}
              onClick={() => setResult(previous => ({ action: key, count: (previous?.count ?? 0) + 1 }))}
            >
              {invisible ? (
                <span
                  data-slot="target-surface"
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'icon' }),
                    'pointer-events-none group-hover/button:bg-muted group-hover/button:text-foreground dark:group-hover/button:bg-input/50'
                  )}
                >
                  <Icon aria-hidden="true" className="size-4" />
                </span>
              ) : (
                <Icon aria-hidden="true" className="size-4" />
              )}
              {showTargets && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 border border-dashed border-foreground bg-foreground/10"
                />
              )}
            </Button>
          </div>
        ))}
      </div>
      <p role="status" aria-atomic="true" className="min-h-12 text-sm leading-relaxed">
        {result ? t('result', { action: t(result.action), count: result.count }) : t('idle')}
      </p>
      <p className="text-sm text-muted-foreground tabular-nums">
        {t('dimensions', { visible: candidate === 'larger' ? 44 : 32, target: expanded ? 44 : 32 })}
      </p>
    </section>
  );
}

function ButtonTargetSize() {
  const t = useTranslations('buttonTargetLab');
  const [showTargets, setShowTargets] = useState(false);

  return (
    <LabPage title={t('title')} description={t('intro')}>
      <section className="space-y-4 rounded-xl bg-muted p-5" aria-label={t('conditions')}>
        <p className="leading-relaxed">{t('task')}</p>
        <label className="flex min-h-11 w-fit cursor-pointer items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={showTargets}
            onChange={event => setShowTargets(event.target.checked)}
            className="size-5 accent-foreground"
          />
          {t('showTargets')}
        </label>
        <p className="text-sm leading-relaxed">{t('spacing')}</p>
      </section>
      <div className="grid gap-4 lg:grid-cols-3">
        {candidates.map(candidate => (
          <TargetCandidate key={candidate} candidate={candidate} showTargets={showTargets} />
        ))}
      </div>
      <section aria-labelledby="target-observe" className="space-y-3 text-sm leading-relaxed">
        <h2 id="target-observe" className="text-lg font-semibold">
          {t('observeTitle')}
        </h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>{t('observePointer')}</li>
          <li>{t('observeBoundary')}</li>
          <li>{t('observeFocus')}</li>
        </ol>
        <p>{t('boundary')}</p>
        <p>{t('standard')}</p>
        <p>{t('limits')}</p>
        <p className="font-medium">{t('question')}</p>
      </section>
    </LabPage>
  );
}

const meta = {
  title: 'Learning/Button target size',
  component: ButtonTargetSize,
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof ButtonTargetSize>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Compare: Story = {};
