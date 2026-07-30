import { Waypoints } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { buildAlternates } from '@/src/app/seo';
import { getNotes, PARA_CATEGORY_KEYS, PARA_LABELS } from '@/src/entities/note';
import { locales, type Locale } from '@/src/shared/config/i18n';
import { ArrowLink, PageHeader } from '@/src/shared/ui';
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
      <div className="space-y-3">
        <PageHeader title={t('title')} description={t('noteCount', { count: notes.length })} />
        <ArrowLink href={{ pathname: '/graph', query: { tab: 'garden' } }}>
          <Waypoints className="size-4" aria-hidden />
          {tCommon('viewGraph')}
        </ArrowLink>
      </div>

      {/* 분류가 이 화면의 1순위 결정이다. status/tags 세그먼트는 자기가 걸러내는 목록
          바로 위에 두어 "이 목록의 필터"로 읽히게 하고, 페이지의 주 내비게이션처럼
          맨 위에서 분류와 경쟁하지 않게 한다. */}
      {overviewItems.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">{t('overviewTitle')}</h2>
          <GardenOverview items={overviewItems} />
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">{t('latestTitle')}</h2>

        <GardenNav
          allLabel={tCommon('all')}
          statusLabels={statusLabels}
          tagsLabel={tCommon('tags')}
          counts={getGardenNavCounts(locale as Locale)}
        />

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
