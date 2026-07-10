import { BookOpen } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { Badge } from '@mumak/ui/components/badge';

import { mdxComponents } from '@/mdx-components';
import { buildAlternates, generateBreadcrumbJsonLd, generateGardenNoteJsonLd, JsonLdScript } from '@/src/app/seo';
import {
  getAllNoteSlugs,
  getBacklinks,
  getNoteEmbedPreview,
  getExistingNoteSlugs,
  hasBlockAnchor,
  hasHeadingAnchor,
  getMergedLinkedNotes,
  getNote,
  getOutgoingNotes,
  isValidParaCategory,
  PARA_LABELS,
  type NoteStatus,
} from '@/src/entities/note';
import { calculateWordCount } from '@/src/entities/post';
import { Link, locales, type Locale } from '@/src/shared/config/i18n';
import { mdxOptions } from '@/src/shared/config/mdx';
import { formatDateForLocale } from '@/src/shared/lib/date';
import { createGardenResolver, transformWikilinks } from '@/src/shared/lib/wikilink';
import { Breadcrumbs } from '@/src/shared/ui';
import { LinkedNotesSection } from '@/src/widgets/linked-notes-section';
import { MDXContent, MDXContentSkeleton } from '@/src/widgets/mdx-content';
import { PostTags } from '@/src/widgets/post-card/ui/post-tags';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wannysim.com';

interface NotePageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams() {
  return locales.flatMap(locale => {
    const slugs = getAllNoteSlugs(locale);
    return slugs.map(slug => ({ locale, slug }));
  });
}

function getNoteDescription(locale: Locale, slug: string, fallbackTitle: string): string {
  const preview = getNoteEmbedPreview(locale, slug);
  return preview?.excerpt ?? `${fallbackTitle} - Digital Garden`;
}

export async function generateMetadata({ params }: NotePageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const note = getNote(locale as Locale, slug);

  if (!note) {
    return { title: 'Not Found' };
  }

  const description = getNoteDescription(locale as Locale, slug, note.meta.title);
  const url = `${BASE_URL}/${locale}/garden/${slug}`;
  const ogLocale = locale === 'ko' ? 'ko_KR' : 'en_US';
  const ogAlternateLocale = locale === 'ko' ? 'en_US' : 'ko_KR';

  return {
    title: note.meta.title,
    description,
    alternates: buildAlternates({ locale, path: `/garden/${slug}` }),
    openGraph: {
      type: 'article',
      url,
      title: note.meta.title,
      description,
      siteName: 'Wan Sim',
      locale: ogLocale,
      alternateLocale: [ogAlternateLocale],
      publishedTime: note.meta.created,
      modifiedTime: note.meta.updated ?? note.meta.created,
      authors: [`${BASE_URL}/${locale}/about`],
      ...(note.meta.tags && note.meta.tags.length > 0 ? { tags: note.meta.tags } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: note.meta.title,
      description,
    },
  };
}

const statusVariants: Record<NoteStatus, 'default' | 'secondary' | 'outline'> = {
  seedling: 'outline',
  budding: 'secondary',
  evergreen: 'default',
};

export default async function NotePage({ params }: NotePageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const note = getNote(locale as Locale, slug);

  if (!note) {
    notFound();
  }

  const [tCommon, tGarden, tPost] = await Promise.all([
    getTranslations({ locale, namespace: 'common' }),
    getTranslations({ locale, namespace: 'garden' }),
    getTranslations({ locale, namespace: 'post' }),
  ]);
  const backlinks = getBacklinks(locale as Locale, slug);
  const outgoingNotes = getOutgoingNotes(locale as Locale, note.meta.outgoingLinks);
  const linkedNotes = getMergedLinkedNotes(outgoingNotes, backlinks);
  const existingSlugs = getExistingNoteSlugs(locale as Locale);
  const resolver = createGardenResolver({
    existingSlugs,
    hasHeadingAnchor: (noteSlug, heading) => hasHeadingAnchor(locale as Locale, noteSlug, heading),
    hasBlockAnchor: (noteSlug, blockId) => hasBlockAnchor(locale as Locale, noteSlug, blockId),
    getEmbedPreview: input =>
      getNoteEmbedPreview(locale as Locale, input.slug, {
        heading: input.heading,
        blockId: input.blockId,
      }),
  });
  const transformedContent = transformWikilinks(note.content, { resolver, currentSlug: slug });

  // PARA 카테고리 단계를 breadcrumb에 포함해 블로그 상세(홈 > 블로그 > 카테고리 > 제목)와
  // 같은 깊이를 유지한다. Uncategorized('garden')는 카테고리 페이지가 없으므로 생략.
  const paraCategory = isValidParaCategory(note.meta.category) ? note.meta.category : null;

  const breadcrumbJsonLd = generateBreadcrumbJsonLd({
    items: [
      { name: tCommon('home'), url: `${BASE_URL}/${locale}` },
      { name: tCommon('garden'), url: `${BASE_URL}/${locale}/garden` },
      ...(paraCategory
        ? [{ name: PARA_LABELS[paraCategory], url: `${BASE_URL}/${locale}/garden/category/${paraCategory}` }]
        : []),
      { name: note.meta.title, url: `${BASE_URL}/${locale}/garden/${slug}` },
    ],
  });

  const noteJsonLd = generateGardenNoteJsonLd({
    note: note.meta,
    locale,
    description: getNoteDescription(locale as Locale, slug, note.meta.title),
    outgoingNotes,
    backlinks,
    wordCount: calculateWordCount(note.content),
  });

  return (
    <div className="max-w-3xl mx-auto">
      <JsonLdScript data={noteJsonLd} />
      <JsonLdScript data={breadcrumbJsonLd} />
      <Breadcrumbs
        items={[
          { label: tCommon('home'), href: '/' },
          { label: tCommon('garden'), href: '/garden' },
          ...(paraCategory ? [{ label: PARA_LABELS[paraCategory], href: `/garden/category/${paraCategory}` }] : []),
          { label: note.meta.title },
        ]}
      />
      <article>
        <header className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant={statusVariants[note.meta.status]}>{tGarden(`status.${note.meta.status}`)}</Badge>
            <time className="text-sm text-muted-foreground" dateTime={note.meta.created}>
              {formatDateForLocale(note.meta.created, locale).text}
            </time>
            <span className="text-muted-foreground">·</span>
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <BookOpen className="size-3.5" aria-hidden />
              {note.meta.readingTime}
              {tPost('readingTimeUnit')}
            </span>
            {note.meta.updated && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-sm text-muted-foreground">
                  {tGarden('updated')}: {formatDateForLocale(note.meta.updated, locale).text}
                </span>
              </>
            )}
          </div>
          <h1 className="text-4xl font-bold mb-4">{note.meta.title}</h1>
          {note.meta.tags && note.meta.tags.length > 0 && (
            <div className="mt-4">
              <PostTags tags={note.meta.tags} basePath="/garden/tags" />
            </div>
          )}
        </header>

        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <Suspense fallback={<MDXContentSkeleton />}>
            <MDXContent source={transformedContent} components={mdxComponents} options={mdxOptions} />
          </Suspense>
        </div>
      </article>

      <LinkedNotesSection
        linkedNotes={linkedNotes}
        linkedNotesLabel={tGarden('linkedNotes')}
        linkDirectionLabels={{
          outgoing: tGarden('linkDirection.outgoing'),
          incoming: tGarden('linkDirection.incoming'),
          bidirectional: tGarden('linkDirection.bidirectional'),
        }}
      />

      <nav className="mt-8 pt-8 border-t border-border">
        <Link href="/garden" className="text-sm font-medium hover:underline">
          ← {tGarden('backToGarden')}
        </Link>
      </nav>
    </div>
  );
}
