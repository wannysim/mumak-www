import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useTranslations } from 'next-intl';
import { useState, type ComponentProps } from 'react';

import { Button } from '@mumak/ui/components/button';

import { LabPage } from './lab-page';

function ButtonPlayground({
  label,
  variant,
  size,
  disabled,
  invalid,
}: {
  label: string;
  variant: ComponentProps<typeof Button>['variant'];
  size: 'default' | 'xs' | 'sm' | 'lg';
  disabled: boolean;
  invalid: boolean;
}) {
  const t = useTranslations('designLab');
  const [count, setCount] = useState(0);
  return (
    <LabPage title={t('buttonTitle')} description={t('buttonIntro')}>
      <section aria-label={t('preview')} className="space-y-6 rounded-xl border border-border p-8">
        <Button
          variant={variant}
          size={size}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          onClick={() => setCount(value => value + 1)}
        >
          {label || t('buttonLabel')}
        </Button>
        <p role="status" className="text-sm text-muted-foreground">
          {t('activated', { count })}
        </p>
      </section>
      <p className="leading-relaxed">{t('buttonHint')}</p>
      <p className="text-sm text-muted-foreground">{t('buttonKnownIssue')}</p>
    </LabPage>
  );
}

const meta = {
  title: 'Components/Button',
  component: ButtonPlayground,
  args: { label: '', variant: 'outline', size: 'default', disabled: false, invalid: false },
  argTypes: {
    variant: { control: 'select', options: ['default', 'outline', 'secondary', 'ghost', 'destructive', 'link'] },
    size: { control: 'select', options: ['xs', 'sm', 'default', 'lg'] },
    label: { control: 'text' },
    disabled: { control: 'boolean' },
    invalid: { control: 'boolean' },
  },
} satisfies Meta<typeof ButtonPlayground>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Playground: Story = {};
export const Disabled: Story = { args: { disabled: true } };
export const Invalid: Story = { args: { invalid: true } };
