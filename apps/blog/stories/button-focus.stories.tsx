import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useTranslations } from 'next-intl';

import { Button } from '@mumak/ui/components/button';

import { PageHeader } from '@/src/shared/ui/page-header';

function ButtonFocus() {
  const t = useTranslations('focusLab');
  return (
    <main className="min-h-screen bg-background p-10 text-foreground">
      <PageHeader title={t('buttonStates')} />
      <div className="mt-8 flex flex-wrap gap-6">
        {(['default', 'outline', 'secondary', 'ghost', 'destructive', 'link'] as const).map(variant => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
        <Button aria-invalid="true">aria-invalid</Button>
        <Button asChild>
          <a href="#button-states">asChild</a>
        </Button>
        <Button disabled>{t('disabled')}</Button>
      </div>
    </main>
  );
}

const meta = { title: 'Learning/Button focus', component: ButtonFocus } satisfies Meta<typeof ButtonFocus>;
export default meta;
type Story = StoryObj<typeof meta>;
export const States: Story = {};
