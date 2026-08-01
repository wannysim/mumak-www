import { BookOpen } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { mdxComponents } from '@/mdx-components';
import { buildAlternates, generateBlogPostingJsonLd, generateBreadcrumbJsonLd, JsonLdScript } from '@/src/app/seo';
import { getMergedLinkedNotes, getNotesByHrefs, getNotesLinkingTo } from '@/src/entities/note';
import {
  calculateWordCount,
  getAllPostSlugs,
  getCategoryLabel,
  getPost,
  getRelatedPosts,
  getSeriesContext,
  isValidCategory,
  toPostHref,
} from '@/src/entities/post';
import { locales, type Locale } from '@/src/shared/config/i18n';
import { mdxOptions } from '@/src/shared/config/mdx';
import { formatDateForLocale } from '@/src/shared/lib/date';
import { Breadcrumbs } from '@/src/shared/ui';
import { LinkedNotesSection, type LinkedItem } from '@/src/widgets/linked-notes-section';
import { MDXContent, MDXContentSkeleton } from '@/src/widgets/mdx-content';
import { NextReading } from '@/src/widgets/next-reading';
import { PostTags } from '@/src/widgets/post-card/ui/post-tags';
import { SeriesNav } from '@/src/widgets/series-nav';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wannysim.com';

// 카테고리 라벨은 getCategoryLabel(entities/post) 단일 소스를 쓴다.
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

  const [tCommon, tPost, tGarden] = await Promise.all([
    getTranslations({ locale, namespace: 'common' }),
    getTranslations({ locale, namespace: 'post' }),
    getTranslations({ locale, namespace: 'garden' }),
  ]);
  const categoryTitle = getCategoryLabel(category, locale as Locale);

  const series = getSeriesContext(locale as Locale, post.meta);

  // 가든 노트는 백링크로 이어지는데 블로그 글은 그렇지 않았다. 글이 인용한 노트와
  // 글을 인용한 노트를 가든 상세와 같은 목록·같은 방향 표기로 보여준다.
  const postHref = toPostHref(post.meta);
  const citedNotes = getNotesByHrefs(locale as Locale, post.meta.outgoingHrefs);
  const citingNotes = getNotesLinkingTo(locale as Locale, postHref);
  const linkedItems: LinkedItem[] = getMergedLinkedNotes(citedNotes, citingNotes).map(linked => ({
    href: `/garden/${linked.slug}`,
    title: linked.title,
    direction: linked.direction,
  }));

  const blogPostingJsonLd = generateBlogPostingJsonLd({
    post: post.meta,
    locale,
    category,
    wordCount: calculateWordCount(post.content),
  });

  const breadcrumbJsonLd = generateBreadcrumbJsonLd({
    items: [
      { name: tCommon('home'), url: `${BASE_URL}/${locale}` },
      { name: tCommon('blog'), url: `${BASE_URL}/${locale}/blog` },
      { name: categoryTitle, url: `${BASE_URL}/${locale}/blog/${category}` },
      { name: post.meta.title, url: `${BASE_URL}/${locale}/blog/${category}/${slug}` },
    ],
  });

  return (
    <div className="max-w-3xl mx-auto">
      <JsonLdScript data={blogPostingJsonLd} />
      <JsonLdScript data={breadcrumbJsonLd} />
      <Breadcrumbs
        items={[
          { label: tCommon('home'), href: '/' },
          { label: tCommon('blog'), href: '/blog' },
          { label: categoryTitle, href: `/blog/${category}` },
          { label: post.meta.title },
        ]}
      />
      <article>
        <header className="mb-8">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <time dateTime={formatDateForLocale(post.meta.date, locale).dateTime}>
              {formatDateForLocale(post.meta.date, locale).text}
            </time>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <BookOpen className="size-3.5" aria-hidden />
              {post.meta.readingTime}
              {tPost('readingTimeUnit')}
            </span>
          </div>
          <h1 className="text-4xl font-bold mb-4">{post.meta.title}</h1>
          <p className="text-lg text-muted-foreground">{post.meta.description}</p>
          {post.meta.tags && post.meta.tags.length > 0 && (
            <div className="mt-4">
              <PostTags tags={post.meta.tags} />
            </div>
          )}
        </header>

        {series && <SeriesNav series={series} />}

        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <Suspense fallback={<MDXContentSkeleton />}>
            <MDXContent source={post.content} components={mdxComponents} options={mdxOptions} />
          </Suspense>
        </div>
      </article>

      {/* 섹션 라벨은 가든과 같은 문구를 쓴다(항목이 전부 가든 노트라 정확하기도 하고,
          두 섹션의 같은 블록이 다른 이름으로 갈리지 않게 한다). 방향 라벨만 글 관점으로
          바꾼다 — 가든 문구는 "이 노트가 참조"라서 글 페이지에서는 주어가 틀린다. */}
      <LinkedNotesSection
        linkedItems={linkedItems}
        linkedNotesLabel={tGarden('linkedNotes')}
        linkDirectionLabels={{
          outgoing: tPost('linkDirection.outgoing'),
          incoming: tPost('linkDirection.incoming'),
          bidirectional: tPost('linkDirection.bidirectional'),
        }}
      />

      <NextReading
        posts={getRelatedPosts(locale as Locale, post.meta)}
        locale={locale as Locale}
        category={category}
        seriesNext={series?.next}
      />
    </div>
  );
}
