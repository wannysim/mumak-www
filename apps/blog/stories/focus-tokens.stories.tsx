import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useTranslations } from 'next-intl';
import { useContext, useEffect, useRef, useState } from 'react';

import { Button } from '@mumak/ui/components/button';

import { LabPage } from './lab-page';
import { LabThemeContext } from './lab-theme';

function TokenSample({ token, label }: { token: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState('');
  useEffect(() => {
    if (ref.current) setValue(getComputedStyle(ref.current).getPropertyValue(token).trim());
  }, [token]);
  return (
    <div ref={ref} className="min-w-0 space-y-3 rounded-xl border border-border p-5">
      <div
        aria-hidden="true"
        className="h-16 rounded-md border border-border"
        style={{ backgroundColor: `var(${token})` }}
      />
      <dt className="font-medium">
        <code>{token}</code> · {label}
      </dt>
      <dd className="break-words font-mono text-sm text-muted-foreground">{value}</dd>
    </div>
  );
}

function FocusTokens() {
  const theme = useContext(LabThemeContext);
  const t = useTranslations('designLab');
  return (
    <LabPage title={t('focusTitle')} description={t('focusIntro')}>
      <dl key={theme} className="grid gap-4 sm:grid-cols-2">
        <TokenSample token="--ring" label={t('focusRole')} />
        <TokenSample token="--accent-foreground" label={t('accentRole')} />
      </dl>
      <section className="space-y-4" aria-labelledby="focus-contract">
        <h2 id="focus-contract" className="text-xl font-semibold">
          {t('contractTitle')}
        </h2>
        <p className="leading-relaxed">{t('contract')}</p>
        <p className="leading-relaxed text-muted-foreground">{t('independent')}</p>
        <Button variant="outline">{t('tryFocus')}</Button>
        <p className="text-sm text-muted-foreground">{t('focusHint')}</p>
      </section>
    </LabPage>
  );
}

const meta = {
  title: 'Foundations/Focus',
  component: FocusTokens,
} satisfies Meta<typeof FocusTokens>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Rules: Story = {};
