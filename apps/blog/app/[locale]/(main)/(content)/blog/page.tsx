import { Waypoints } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { buildAlternates } from '@/src/app/seo';
import { getCategories, getPosts, type Category } from '@/src/entities/post';
import { type Locale } from '@/src/shared/config/i18n';
import { ArrowLink, PageHeader } from '@/src/shared/ui';
import { BlogNav, getBlogNavCounts } from '@/src/widgets/blog-nav';
import { BlogSearch } from '@/src/widgets/blog-search';
import { PostCard } from '@/src/widgets/post-card';

interface BlogPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: BlogPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'blog' });

  return {
    title: t('title'),
    description: t('description'),
    alternates: buildAlternates({ locale, path: '/blog' }),
  };
}

export default async function BlogPage({ params }: BlogPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tCommon] = await Promise.all([getTranslations('blog'), getTranslations('common')]);

  const posts = getPosts(locale as Locale);
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
      <div className="space-y-3">
        <PageHeader title={t('title')} description={t('description')} />
        <ArrowLink href={{ pathname: '/graph', query: { tab: 'blog' } }}>
          <Waypoints className="size-4" aria-hidden />
          {tCommon('viewGraph')}
        </ArrowLink>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <BlogNav
          allLabel={tCommon('all')}
          categoryLabels={categoryLabels}
          tagsLabel={tCommon('tags')}
          counts={getBlogNavCounts(locale as Locale)}
        />
        <BlogSearch categoryLabels={categoryLabels} triggerClassName="sm:w-72" />
      </div>

      <section className="space-y-6">
        {posts.length === 0 ? (
          <p className="text-muted-foreground">No posts yet.</p>
        ) : (
          posts.map(post => (
            <PostCard
              key={`${post.category}-${post.slug}`}
              post={post}
              locale={locale}
              categoryLabel={tCommon(post.category)}
            />
          ))
        )}
      </section>
    </div>
  );
}
