import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { buildAlternates } from '@/src/app/seo';
import { getNotes, PARA_CATEGORY_KEYS, PARA_LABELS } from '@/src/entities/note';
import { locales, type Locale } from '@/src/shared/config/i18n';
import { PageHeader } from '@/src/shared/ui';
import { GardenNav, getGardenNavCounts } from '@/src/widgets/garden-nav';
import { GardenOverview } from '@/src/widgets/garden-overview';
import { NoteCard } from '@/src/widgets/note-card';

const LATEST_NOTE_COUNT = 8;

interface GardenPageProps {
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return locales.map(locale => ({ locale }));
}

export async function generateMetadata({ params }: GardenPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'garden' });

  return {
    title: t('title'),
    description: t('description'),
    alternates: buildAlternates({ locale, path: '/garden' }),
  };
}

export default async function GardenPage({ params }: GardenPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const notes = getNotes(locale as Locale);
  const [t, tCommon] = await Promise.all([getTranslations('garden'), getTranslations('common')]);

  const statusLabels = {
    seedling: t('status.seedling'),
    budding: t('status.budding'),
    evergreen: t('status.evergreen'),
  };

  const overviewItems = PARA_CATEGORY_KEYS.map(key => ({
    key,
    label: PARA_LABELS[key],
    description: t(`categories.${key}.description`),
    count: notes.filter(note => (note.category || 'garden') === key).length,
  })).filter(item => item.count > 0);

  const latestNotes = notes.toSorted((a, b) => b.created.localeCompare(a.created)).slice(0, LATEST_NOTE_COUNT);

  return (
    <div className="space-y-8">
      <PageHeader title={t('title')} description={t('noteCount', { count: notes.length })} />

      <GardenNav
        allLabel={tCommon('all')}
        statusLabels={statusLabels}
        tagsLabel={tCommon('tags')}
        counts={getGardenNavCounts(locale as Locale)}
      />

      {overviewItems.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">{t('overviewTitle')}</h2>
          <GardenOverview items={overviewItems} />
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">{t('latestTitle')}</h2>
        {latestNotes.length === 0 ? (
          <p className="text-muted-foreground">{t('empty')}</p>
        ) : (
          <div className="space-y-4">
            {latestNotes.map(note => (
              <NoteCard key={note.slug} note={note} locale={locale} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
