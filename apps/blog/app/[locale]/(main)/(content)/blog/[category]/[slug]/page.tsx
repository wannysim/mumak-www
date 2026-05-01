import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { mdxComponents } from '@/mdx-components';
import { buildAlternates, generateBlogPostingJsonLd, generateBreadcrumbJsonLd, JsonLdScript } from '@/src/app/seo';
import { calculateWordCount, getAllPostSlugs, getPost, isValidCategory } from '@/src/entities/post';
import { Link, locales, type Locale } from '@/src/shared/config/i18n';
import { mdxOptions } from '@/src/shared/config/mdx';
import { formatDateForLocale } from '@/src/shared/lib/date';
import { MDXContent, MDXContentSkeleton } from '@/src/widgets/mdx-content';
import { PostTags } from '@/src/widgets/post-card/ui/post-tags';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wannysim.com';

const staticTranslations = {
  ko: {
    home: '홈',
    blog: '블로그',
    backToList: '목록으로 돌아가기',
    category: { essay: '에세이', articles: '아티클', notes: '노트' },
  },
  en: {
    home: 'Home',
    blog: 'Blog',
    backToList: 'Back to list',
    category: { essay: 'Essay', articles: 'Articles', notes: 'Notes' },
  },
} as const;

interface PostPageProps {
  params: Promise<{ locale: string; category: string; slug: string }>;
}

export function generateStaticParams() {
  return locales.flatMap(locale => {
    const slugs = getAllPostSlugs(locale);
    return slugs.map(({ category, slug }) => ({ locale, category, slug }));
  });
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { locale, category, slug } = await params;

  if (!isValidCategory(category)) {
    return { title: 'Not Found' };
  }

  const post = getPost(locale as Locale, category, slug);

  if (!post) {
    return { title: 'Not Found' };
  }

  const url = `${BASE_URL}/${locale}/blog/${category}/${slug}`;
  const ogLocale = locale === 'ko' ? 'ko_KR' : 'en_US';
  const ogAlternateLocale = locale === 'ko' ? 'en_US' : 'ko_KR';

  return {
    title: post.meta.title,
    description: post.meta.description,
    alternates: buildAlternates({ locale, path: `/blog/${category}/${slug}` }),
    openGraph: {
      type: 'article',
      url,
      title: post.meta.title,
      description: post.meta.description,
      siteName: 'Wan Sim',
      locale: ogLocale,
      alternateLocale: [ogAlternateLocale],
      publishedTime: post.meta.date,
      modifiedTime: post.meta.updated ?? post.meta.date,
      authors: [`${BASE_URL}/${locale}/about`],
      ...(post.meta.tags && post.meta.tags.length > 0 ? { tags: post.meta.tags } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.meta.title,
      description: post.meta.description,
    },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { locale, category, slug } = await params;

  if (!isValidCategory(category)) {
    notFound();
  }

  setRequestLocale(locale);

  const post = getPost(locale as Locale, category, slug);

  if (!post) {
    notFound();
  }

  const localeKey = (locale === 'ko' ? 'ko' : 'en') as keyof typeof staticTranslations;
  const translations = staticTranslations[localeKey];
  const categoryTitle = translations.category[category as keyof typeof translations.category];

  const blogPostingJsonLd = generateBlogPostingJsonLd({
    post: post.meta,
    locale,
    category,
    wordCount: calculateWordCount(post.content),
  });

  const breadcrumbJsonLd = generateBreadcrumbJsonLd({
    items: [
      { name: translations.home, url: `${BASE_URL}/${locale}` },
      { name: translations.blog, url: `${BASE_URL}/${locale}/blog` },
      { name: categoryTitle, url: `${BASE_URL}/${locale}/blog/${category}` },
      { name: post.meta.title, url: `${BASE_URL}/${locale}/blog/${category}/${slug}` },
    ],
  });

  return (
    <div className="max-w-3xl mx-auto">
      <JsonLdScript data={blogPostingJsonLd} />
      <JsonLdScript data={breadcrumbJsonLd} />
      <article>
        <header className="mb-8">
          <div className="text-sm text-muted-foreground mb-2">
            <time dateTime={formatDateForLocale(post.meta.date, locale).dateTime}>
              {formatDateForLocale(post.meta.date, locale).text}
            </time>
          </div>
          <h1 className="text-4xl font-bold mb-4">{post.meta.title}</h1>
          <p className="text-lg text-muted-foreground">{post.meta.description}</p>
          {post.meta.tags && post.meta.tags.length > 0 && (
            <div className="mt-4">
              <PostTags tags={post.meta.tags} />
            </div>
          )}
        </header>

        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <Suspense fallback={<MDXContentSkeleton />}>
            <MDXContent source={post.content} components={mdxComponents} options={mdxOptions} />
          </Suspense>
        </div>
      </article>

      <nav className="mt-12 pt-8 border-t border-border">
        <Link href={`/blog/${category}`} className="text-sm font-medium hover:underline">
          ← {translations.backToList}
        </Link>
      </nav>
    </div>
  );
}
