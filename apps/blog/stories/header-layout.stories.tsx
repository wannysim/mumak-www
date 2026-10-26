import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useGlobals } from 'storybook/preview-api';

import { PageHeader } from '@/src/shared/ui/page-header';

import { HeaderLayoutPreview } from './header-layout-preview';

import './header-layout.css';

function HeaderLayoutLab({
  theme,
  onGlobalsChange,
}: {
  theme: 'light' | 'dark';
  onGlobalsChange: (globals: { theme?: string; locale?: string }) => void;
}) {
  const t = useTranslations('headerLayoutLab');
  const [showTargets, setShowTargets] = useState(false);
  return (
    <main className="min-h-screen bg-background py-8 text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <div className="flex flex-col gap-5 px-4 sm:px-6">
          <PageHeader title={t('title')} description={t('intro')} />
          <p className="text-sm leading-relaxed">{t('conditions')}</p>
          <label className="flex min-h-11 w-fit cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={showTargets}
              onChange={event => setShowTargets(event.target.checked)}
              className="size-5 accent-foreground"
            />
            {t('showTargets')}
          </label>
        </div>
        {(['current', 'targets', 'home'] as const).map(candidate => (
          <HeaderLayoutPreview
            key={candidate}
            candidate={candidate}
            showTargets={showTargets}
            theme={theme}
            onGlobalsChange={onGlobalsChange}
          />
        ))}
        <aside className="flex flex-col gap-3 px-4 sm:px-6">
          <h2 className="text-xl font-semibold">{t('observeTitle')}</h2>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed">
            <li>{t('observeTouch')}</li>
            <li>{t('observeHome')}</li>
            <li>{t('observeSpace')}</li>
          </ol>
          <p className="text-sm text-muted-foreground">{t('scope')}</p>
        </aside>
      </div>
    </main>
  );
}

const meta = {
  title: 'Learning/Header layout',
  component: HeaderLayoutLab,
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof HeaderLayoutLab>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Compare: Story = {
  args: { theme: 'light', onGlobalsChange: () => {} },
  render: function Render() {
    const [globals, updateGlobals] = useGlobals();
    return <HeaderLayoutLab theme={globals.theme === 'dark' ? 'dark' : 'light'} onGlobalsChange={updateGlobals} />;
  },
};
