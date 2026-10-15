import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useLocale, useTranslations } from 'next-intl';
import { useContext } from 'react';

import { LabPage } from './lab-page';
import { LabThemeContext } from './lab-theme';

const lessons = [
  { key: 'focus', story: 'foundations-focus--rules' },
  { key: 'button', story: 'components-button--playground' },
  { key: 'card', story: 'components-content-card--playground' },
  { key: 'comparison', story: 'learning-focus-comparison--compare' },
] as const;

function Start() {
  const t = useTranslations('designLab');
  const locale = useLocale();
  const theme = useContext(LabThemeContext);
  return (
    <LabPage title={t('title')} description={t('intro')}>
      <section className="space-y-4" aria-labelledby="lab-route">
        <h2 id="lab-route" className="text-xl font-semibold">
          {t('route')}
        </h2>
        <ol className="grid gap-4 sm:grid-cols-2">
          {lessons.map(({ key, story }, index) => (
            <li key={key}>
              <a
                href={`./?path=/story/${story}&globals=locale:${locale};theme:${theme}`}
                target="_top"
                className="block h-full space-y-3 rounded-xl border border-border p-6 transition-colors hover:bg-muted"
              >
                <span className="text-sm text-muted-foreground">0{index + 1}</span>
                <h3 className="text-lg font-semibold">{t(`${key}Title`)}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{t(`${key}Summary`)}</p>
              </a>
            </li>
          ))}
        </ol>
      </section>
      <aside className="space-y-3 rounded-xl bg-muted p-6">
        <h2 className="text-lg font-semibold">{t('howTitle')}</h2>
        <p className="leading-relaxed">{t('how')}</p>
        <p className="text-sm text-foreground">{t('scope')}</p>
      </aside>
    </LabPage>
  );
}

const meta = { title: 'Start/Welcome', component: Start, parameters: { controls: { disable: true } } } satisfies Meta<
  typeof Start
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Welcome: Story = {};
