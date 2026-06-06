import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { buildAlternates } from '@/src/app/seo';
import { getAllNoteTags } from '@/src/entities/note';
import { locales, type Locale } from '@/src/shared/config/i18n';
import { PageHeader } from '@/src/shared/ui';
import { GardenNav } from '@/src/widgets/garden-nav';
import { TagCloud } from '@/src/widgets/tag-cloud';

interface GardenTagsPageProps {
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return locales.map(locale => ({ locale }));
}

export async function generateMetadata({ params }: GardenTagsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'garden.tags' });

  return {
    title: t('title'),
    description: t('description', { count: 0 }),
    alternates: buildAlternates({ locale, path: '/garden/tags' }),
  };
}

export default async function GardenTagsPage({ params }: GardenTagsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tGarden, tCommon] = await Promise.all([
    getTranslations('garden.tags'),
    getTranslations('garden'),
    getTranslations('common'),
  ]);
  const tags = getAllNoteTags(locale as Locale).map(tag => ({
    ...tag,
    slug: encodeURIComponent(tag.name),
  }));

  const statusLabels = {
    seedling: tGarden('status.seedling'),
    budding: tGarden('status.budding'),
    evergreen: tGarden('status.evergreen'),
  };

  return (
    <div className="space-y-8">
      <PageHeader title={t('title')} description={t('description', { count: tags.length })} />

      <GardenNav allLabel={tCommon('all')} statusLabels={statusLabels} tagsLabel={tCommon('tags')} />

      <section>
        {tags.length === 0 ? (
          <p className="text-muted-foreground">{tGarden('empty')}</p>
        ) : (
          <TagCloud tags={tags} basePath="/garden/tags" showCount />
        )}
      </section>
    </div>
  );
}
