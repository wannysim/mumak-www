import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { buildAlternates } from '@/src/app/seo';
import { getCategories, type Category } from '@/src/entities/post';
import { getAllTags } from '@/src/entities/tag';
import { type Locale } from '@/src/shared/config/i18n';
import { PageHeader } from '@/src/shared/ui';
import { BlogNav, getBlogNavCounts } from '@/src/widgets/blog-nav';
import { TagCloud } from '@/src/widgets/tag-cloud';

interface TagsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: TagsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'tags' });

  return {
    title: t('title'),
    description: t('metaDescription'),
    alternates: buildAlternates({ locale, path: '/blog/tags' }),
  };
}

export default async function TagsPage({ params }: TagsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tCommon] = await Promise.all([getTranslations('tags'), getTranslations('common')]);

  const tags = getAllTags(locale as Locale);
  const categories = getCategories();

  const categoryLabels = categories.reduce(
    (acc, cat) => {
      acc[cat] = tCommon(cat);
      return acc;
    },
    {} as Record<Category, string>
  );

  return (
    <div className="space-y-8">
      <PageHeader title={t('title')} description={t('description', { count: tags.length })} />

      <BlogNav
        allLabel={tCommon('all')}
        categoryLabels={categoryLabels}
        tagsLabel={tCommon('tags')}
        counts={getBlogNavCounts(locale as Locale)}
      />

      <section>
        {tags.length === 0 ? <p className="text-muted-foreground">{t('empty')}</p> : <TagCloud tags={tags} showCount />}
      </section>
    </div>
  );
}
