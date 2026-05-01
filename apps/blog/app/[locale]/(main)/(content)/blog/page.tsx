import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { buildAlternates } from '@/src/app/seo';
import { getCategories, getPosts, type Category } from '@/src/entities/post';
import { type Locale } from '@/src/shared/config/i18n';
import { BlogNav } from '@/src/widgets/blog-nav';
import { BlogSearch, type BlogSearchPost } from '@/src/widgets/blog-search';
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

  const t = await getTranslations('blog');
  const tCommon = await getTranslations('common');

  const posts = getPosts(locale as Locale);
  const categories = getCategories();

  const categoryLabels = categories.reduce(
    (acc, cat) => {
      acc[cat] = tCommon(cat);
      return acc;
    },
    {} as Record<Category, string>
  );

  const searchPosts: BlogSearchPost[] = posts.map(post => ({
    title: post.title,
    description: post.description,
    category: post.category,
    slug: post.slug,
    tags: post.tags ?? [],
  }));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <BlogNav allLabel={tCommon('all')} categoryLabels={categoryLabels} tagsLabel={tCommon('tags')} />
        <BlogSearch posts={searchPosts} categoryLabels={categoryLabels} triggerClassName="sm:w-72" />
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
