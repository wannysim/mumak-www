import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useTranslations } from 'next-intl';
import { useContext, useEffect, useId, useRef, useState } from 'react';

import { Button } from '@mumak/ui/components/button';
import { cn } from '@mumak/ui/lib/utils';

import { measureButtonContrast } from './button-contrast-measurement';
import { LabPage } from './lab-page';
import { LabThemeContext } from './lab-theme';

import './button-contrast.css';

type Measurement = ReturnType<typeof measureButtonContrast>;
type Candidate = 'current' | 'deeper' | 'ink' | 'brighter' | 'stronger';

function ContrastCandidate({ candidate, surface }: { candidate: Candidate; surface: string }) {
  const t = useTranslations('buttonContrastLab');
  const theme = useContext(LabThemeContext);
  const titleId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const disabled = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const [disabledRatio, setDisabledRatio] = useState<number | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const target = button.current;
    const inactive = disabled.current;
    const background = panel.current;
    if (!target || !inactive || !background) return;
    let frame = 0;
    const measure = () => {
      const next = measureButtonContrast(target, background);
      setMeasurement(previous => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next));
      setDisabledRatio(measureButtonContrast(inactive, background).ratio);
      // Touch :active can end after pointerup without an event or a reduced-motion transition.
      if (target.matches(':active') || target.getAnimations().length) frame = requestAnimationFrame(measure);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const events = [
      'pointerenter',
      'pointerleave',
      'pointerdown',
      'pointerup',
      'pointercancel',
      'focus',
      'blur',
      'keydown',
      'keyup',
      'transitionrun',
      'transitionend',
    ];
    events.forEach(event => target.addEventListener(event, schedule));
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      events.forEach(event => target.removeEventListener(event, schedule));
    };
    // These inputs change inherited CSS; remeasure without remounting the buttons.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [theme, surface]);

  return (
    <section aria-labelledby={titleId} className="min-w-0 space-y-4 rounded-xl border border-border p-5">
      <header className="space-y-2">
        <h2 id={titleId} className="text-lg font-semibold">
          {t(`${candidate}Title`)}
        </h2>
        <p className="min-h-24 text-sm leading-relaxed">
          {t(theme === 'dark' ? 'darkDescription' : `${candidate}Description`)}
        </p>
      </header>
      <div
        ref={panel}
        data-button-contrast={candidate}
        className={cn('space-y-5 rounded-lg p-5', surface === 'muted' ? 'bg-muted' : 'bg-background')}
      >
        <Button ref={button} onClick={() => setCount(value => value + 1)}>
          {t('save')}
        </Button>
        <div>
          <Button ref={disabled} disabled>
            {t('disabled')}
          </Button>
        </div>
      </div>
      <dl className="space-y-3 text-sm">
        <div>
          <dt>{t('currentState')}</dt>
          <dd className="font-medium">{measurement ? t(measurement.state) : '…'}</dd>
        </div>
        <div>
          <dt>{t('textContrast')}</dt>
          <dd className="text-lg font-semibold tabular-nums" data-contrast-ratio={measurement?.ratio}>
            {measurement
              ? `${measurement.ratio.toFixed(2)}:1 · ${t(measurement.ratio >= 4.5 ? 'meets' : 'below')}`
              : '…'}
          </dd>
        </div>
        <div>
          <dt>{t('disabledContrast')}</dt>
          <dd className="tabular-nums" data-disabled-contrast={disabledRatio ?? undefined}>
            {disabledRatio === null ? '…' : `${disabledRatio.toFixed(2)}:1`}
          </dd>
        </div>
      </dl>
      <p role="status" className="text-sm">
        {t('activated', { count })}
      </p>
      <details className="text-sm">
        <summary className="cursor-pointer rounded-sm">{t('colors')}</summary>
        <p className="mt-2 break-words font-mono">
          {measurement?.foreground} / {measurement?.background}
        </p>
      </details>
    </section>
  );
}

function ButtonContrast({ comparison = 'initial' }: { comparison?: 'initial' | 'brightness' | 'hover' }) {
  const t = useTranslations('buttonContrastLab');
  const theme = useContext(LabThemeContext);
  const [surface, setSurface] = useState('background');
  const candidates: Candidate[] =
    comparison === 'hover'
      ? ['brighter', 'stronger']
      : ['current', 'deeper', comparison === 'brightness' ? 'brighter' : 'ink'];
  const title = comparison === 'hover' ? 'hoverTitle' : comparison === 'brightness' ? 'refineTitle' : 'title';
  const intro = comparison === 'hover' ? 'hoverIntro' : comparison === 'brightness' ? 'refineIntro' : 'intro';
  return (
    <LabPage title={t(title)} description={t(intro)}>
      <p className="leading-relaxed">{t('instructions')}</p>
      <label className="flex w-fit flex-col gap-2 text-sm font-medium">
        {t('surface')}
        <select
          className="rounded-md border border-border bg-background px-3 py-2"
          value={surface}
          onChange={event => setSurface(event.target.value)}
        >
          <option value="background">{t('background')}</option>
          <option value="muted">{t('muted')}</option>
        </select>
      </label>
      {theme === 'dark' && <p className="rounded-lg bg-muted p-4 text-sm">{t('darkNote')}</p>}
      <div className={cn('grid gap-4', comparison === 'hover' ? 'lg:grid-cols-2' : 'lg:grid-cols-3')}>
        {candidates.map(candidate => (
          <ContrastCandidate key={candidate} candidate={candidate} surface={surface} />
        ))}
      </div>
      <aside className="space-y-3 text-sm leading-relaxed">
        <p>{t('measurement')}</p>
        <p>{t('disabledNote')}</p>
        <p>{t('pressedNote')}</p>
        <p>{t(comparison === 'hover' ? 'hoverQuestion' : 'question')}</p>
        <a
          className="rounded-sm underline underline-offset-4"
          href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html"
          target="_blank"
          rel="noreferrer"
        >
          {t('reference')}
        </a>
      </aside>
    </LabPage>
  );
}

const meta = {
  title: 'Learning/Button contrast',
  component: ButtonContrast,
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof ButtonContrast>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Compare: Story = {};
export const Refine: Story = { args: { comparison: 'brightness' } };
export const Hover: Story = { args: { comparison: 'hover' } };
