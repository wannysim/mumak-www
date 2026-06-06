import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { buildAlternates } from '@/src/app/seo';
import { getNotesByCategory, isValidParaCategory, PARA_CATEGORY_KEYS, PARA_LABELS } from '@/src/entities/note';
import { locales, type Locale } from '@/src/shared/config/i18n';
import { PageHeader } from '@/src/shared/ui';
import { GardenNav } from '@/src/widgets/garden-nav';
import { NoteCard } from '@/src/widgets/note-card';

interface GardenCategoryPageProps {
  params: Promise<{ locale: string; key: string }>;
}

export function generateStaticParams() {
  return locales.flatMap(locale => PARA_CATEGORY_KEYS.map(key => ({ locale, key })));
}

export async function generateMetadata({ params }: GardenCategoryPageProps): Promise<Metadata> {
  const { locale, key } = await params;

  if (!isValidParaCategory(key)) {
    return { title: 'Not Found' };
  }

  const t = await getTranslations({ locale, namespace: 'garden' });

  return {
    title: `${PARA_LABELS[key]} - ${t('title')}`,
    description: t(`categories.${key}.description`),
    alternates: buildAlternates({ locale, path: `/garden/category/${key}` }),
  };
}

export default async function GardenCategoryPage({ params }: GardenCategoryPageProps) {
  const { locale, key } = await params;
  setRequestLocale(locale);

  if (!isValidParaCategory(key)) {
    notFound();
  }

  const [t, tCommon] = await Promise.all([getTranslations('garden'), getTranslations('common')]);
  const notes = getNotesByCategory(locale as Locale, key);

  const statusLabels = {
    seedling: t('status.seedling'),
    budding: t('status.budding'),
    evergreen: t('status.evergreen'),
  };

  return (
    <div className="space-y-8">
      <PageHeader title={PARA_LABELS[key]} description={t(`categories.${key}.description`)} />

      <GardenNav allLabel={tCommon('all')} statusLabels={statusLabels} tagsLabel={tCommon('tags')} />

      <section className="space-y-4">
        {notes.length === 0 ? (
          <p className="text-muted-foreground">{t('empty')}</p>
        ) : (
          notes.map(note => <NoteCard key={note.slug} note={note} locale={locale} />)
        )}
      </section>
    </div>
  );
}
