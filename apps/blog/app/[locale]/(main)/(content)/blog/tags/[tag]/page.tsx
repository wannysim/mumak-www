import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { buildAlternates } from '@/src/app/seo';
import { getCategories, type Category } from '@/src/entities/post';
import { getAllTags, getPostsByTag, isValidTag } from '@/src/entities/tag';
import { locales, type Locale } from '@/src/shared/config/i18n';
import { BlogNav } from '@/src/widgets/blog-nav';
import { PostCard } from '@/src/widgets/post-card';
import { TagCloud } from '@/src/widgets/tag-cloud';

interface TagPageProps {
  params: Promise<{ locale: string; tag: string }>;
}

export function generateStaticParams() {
  return locales.flatMap(locale => {
    const tags = getAllTags(locale);
    return tags.map(tag => ({ locale, tag: tag.slug }));
  });
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { locale, tag } = await params;

  if (!isValidTag(locale as Locale, tag)) {
    return { title: 'Not Found' };
  }

  const t = await getTranslations({ locale, namespace: 'tags' });
  const decodedTag = decodeURIComponent(tag);

  return {
    title: t('tagTitle', { tag: decodedTag }),
    description: t('tagDescription', { tag: decodedTag }),
    alternates: buildAlternates({ locale, path: `/blog/tags/${tag}` }),
  };
}

export default async function TagPage({ params }: TagPageProps) {
  const { locale, tag } = await params;

  if (!isValidTag(locale as Locale, tag)) {
    notFound();
  }

  setRequestLocale(locale);

  const t = await getTranslations('tags');
  const tCommon = await getTranslations('common');

  const decodedTag = decodeURIComponent(tag);
  const posts = getPostsByTag(locale as Locale, tag);
  const allTags = getAllTags(locale as Locale);
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
      <header>
        <h1 className="text-3xl font-bold mb-2">#{decodedTag}</h1>
        <p className="text-muted-foreground">{t('postCount', { count: posts.length })}</p>
      </header>

      <BlogNav allLabel={tCommon('all')} categoryLabels={categoryLabels} tagsLabel={tCommon('tags')} />

      <TagCloud tags={allTags} activeTag={decodedTag} showCount />

      <section className="space-y-6">
        {posts.length === 0 ? (
          <p className="text-muted-foreground">{t('empty')}</p>
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
