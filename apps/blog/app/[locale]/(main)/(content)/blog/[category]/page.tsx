import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { getCategories, getPosts, isValidCategory, type Category } from '@/src/entities/post';
import { locales, type Locale } from '@/src/shared/config/i18n';
import { BlogNav } from '@/src/widgets/blog-nav';
import { BlogSearch, type BlogSearchPost } from '@/src/widgets/blog-search';
import { PostCard } from '@/src/widgets/post-card';

interface BlogCategoryPageProps {
  params: Promise<{ locale: string; category: string }>;
}

export function generateStaticParams() {
  const categories = getCategories();
  return locales.flatMap(locale => categories.map(category => ({ locale, category })));
}

export async function generateMetadata({ params }: BlogCategoryPageProps): Promise<Metadata> {
  const { locale, category } = await params;

  if (!isValidCategory(category)) {
    return { title: 'Not Found' };
  }

  const t = await getTranslations({ locale, namespace: 'category' });

  return {
    title: t(`${category}.title`),
    description: t(`${category}.description`),
  };
}

export default async function BlogCategoryPage({ params }: BlogCategoryPageProps) {
  const { locale, category } = await params;

  if (!isValidCategory(category)) {
    notFound();
  }

  setRequestLocale(locale);

  const t = await getTranslations('category');
  const tCommon = await getTranslations('common');

  const posts = getPosts(locale as Locale, category as Category);
  const allPosts = getPosts(locale as Locale);
  const categories = getCategories();

  const categoryLabels = categories.reduce(
    (acc, cat) => {
      acc[cat] = tCommon(cat);
      return acc;
    },
    {} as Record<Category, string>
  );

  const searchPosts: BlogSearchPost[] = allPosts.map(post => ({
    title: post.title,
    description: post.description,
    category: post.category,
    slug: post.slug,
    tags: post.tags ?? [],
  }));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold mb-2">{t(`${category}.title`)}</h1>
        <p className="text-muted-foreground">{t(`${category}.description`)}</p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <BlogNav allLabel={tCommon('all')} categoryLabels={categoryLabels} tagsLabel={tCommon('tags')} />
        <BlogSearch posts={searchPosts} categoryLabels={categoryLabels} triggerClassName="sm:w-72" />
      </div>

      <section className="space-y-6">
        {posts.length === 0 ? (
          <p className="text-muted-foreground">No posts yet.</p>
        ) : (
          posts.map(post => <PostCard key={post.slug} post={post} locale={locale} />)
        )}
      </section>
    </div>
  );
}
