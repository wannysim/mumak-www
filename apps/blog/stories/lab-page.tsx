import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { PageHeader } from '@/src/shared/ui/page-header';

export function LabPage({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const t = useTranslations('designLab');
  return (
    <main className="min-h-screen bg-background px-5 py-10 text-foreground sm:px-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <p className="text-sm font-medium text-muted-foreground">{t('eyebrow')}</p>
        <PageHeader title={title} description={description} />
        {children}
      </div>
    </main>
  );
}
