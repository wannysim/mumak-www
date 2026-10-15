import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Link } from '@/src/shared/config/i18n';
import { ContentCard } from '@/src/shared/ui/content-card';

import { LabPage } from './lab-page';

function CardPlayground({
  title,
  showDescription,
  showTag,
}: {
  title: string;
  showDescription: boolean;
  showTag: boolean;
}) {
  const t = useTranslations('designLab');
  const f = useTranslations('focusLab');
  const [activated, setActivated] = useState(false);
  return (
    <LabPage title={t('cardTitle')} description={t('cardIntro')}>
      <section
        aria-label={t('preview')}
        className="space-y-6"
        onClickCapture={event => {
          if (event.target instanceof Element && event.target.closest('a')) {
            event.preventDefault();
            setActivated(true);
          }
        }}
      >
        <h2 className="text-xl font-semibold">{t('preview')}</h2>
        <ContentCard
          href="/blog"
          title={title || f('cardTitle')}
          meta={f('cardMeta')}
          description={showDescription ? f('cardDescription') : undefined}
          tags={
            showTag ? (
              <Link href="/blog/tags" className="rounded-sm text-sm text-muted-foreground underline underline-offset-4">
                {f('tag')}
              </Link>
            ) : undefined
          }
        />
        <p role="status" className="min-h-6 text-sm text-muted-foreground">
          {activated ? f('linkActivated') : ''}
        </p>
      </section>
      <p className="leading-relaxed">{t('cardHint')}</p>
      <p className="text-sm text-muted-foreground">{f('activationNote')}</p>
    </LabPage>
  );
}

const meta = {
  title: 'Components/Content card',
  component: CardPlayground,
  args: { title: '', showDescription: true, showTag: true },
  argTypes: {
    title: { control: 'text' },
    showDescription: { control: 'boolean' },
    showTag: { control: 'boolean' },
  },
} satisfies Meta<typeof CardPlayground>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Playground: Story = {};
export const TitleOnly: Story = { args: { showDescription: false, showTag: false } };
