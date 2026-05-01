import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { buildAlternates } from '@/src/app/seo';
import { getNotesByStatus, type NoteStatus } from '@/src/entities/note';
import { locales, type Locale } from '@/src/shared/config/i18n';
import { GardenNav } from '@/src/widgets/garden-nav';
import { NoteCard } from '@/src/widgets/note-card';

const VALID_STATUSES: NoteStatus[] = ['seedling', 'budding', 'evergreen'];

interface GardenStatusPageProps {
  params: Promise<{ locale: string; status: string }>;
}

export function generateStaticParams() {
  return locales.flatMap(locale => VALID_STATUSES.map(status => ({ locale, status })));
}

export async function generateMetadata({ params }: GardenStatusPageProps): Promise<Metadata> {
  const { locale, status } = await params;

  if (!VALID_STATUSES.includes(status as NoteStatus)) {
    return { title: 'Not Found' };
  }

  const t = await getTranslations({ locale, namespace: 'garden' });

  return {
    title: `${t(`status.${status}`)} - ${t('title')}`,
    description: t('description'),
    alternates: buildAlternates({ locale, path: `/garden/status/${status}` }),
  };
}

export default async function GardenStatusPage({ params }: GardenStatusPageProps) {
  const { locale, status } = await params;
  setRequestLocale(locale);

  if (!VALID_STATUSES.includes(status as NoteStatus)) {
    notFound();
  }

  const t = await getTranslations('garden');
  const tCommon = await getTranslations('common');
  const notes = getNotesByStatus(locale as Locale, status as NoteStatus);

  const statusLabels = {
    seedling: t('status.seedling'),
    budding: t('status.budding'),
    evergreen: t('status.evergreen'),
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold mb-2">{t(`status.${status}`)}</h1>
        <p className="text-muted-foreground">{t('noteCount', { count: notes.length })}</p>
      </header>

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
