import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { Badge } from '@mumak/ui/components/badge';

import { mdxComponents } from '@/mdx-components';
import { generateBreadcrumbJsonLd, JsonLdScript } from '@/src/app/seo';
import { mdxOptions } from '@/src/shared/config/mdx';
import { MDXContent, MDXContentSkeleton } from '@/src/widgets/mdx-content';
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
  type NoteStatus,
} from '@/src/entities/note';
import { Link, locales, type Locale } from '@/src/shared/config/i18n';
import { formatDateForLocale } from '@/src/shared/lib/date';
import { createGardenResolver, transformWikilinks } from '@/src/shared/lib/wikilink';
import { LinkedNotesSection } from '@/src/widgets/linked-notes-section';
import { PostTags } from '@/src/widgets/post-card/ui/post-tags';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wannysim.com';

const staticTranslations = {
  ko: {
    home: '홈',
    garden: '가든',
    updated: '수정됨',
    linkedNotes: '연결된 노트',
    backToGarden: '가든으로 돌아가기',
    status: { seedling: '씨앗', budding: '새싹', evergreen: '상록수' },
    linkDirection: { outgoing: '이 노트가 참조', incoming: '이 노트를 참조', bidirectional: '서로 참조' },
  },
  en: {
    home: 'Home',
    garden: 'Garden',
    updated: 'Updated',
    linkedNotes: 'Linked Notes',
    backToGarden: 'Back to Garden',
    status: { seedling: 'Seedling', budding: 'Budding', evergreen: 'Evergreen' },
    linkDirection: {
      outgoing: 'This note references',
      incoming: 'References this note',
      bidirectional: 'Mutual reference',
    },
  },
} as const;

interface NotePageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams() {
  return locales.flatMap(locale => {
    const slugs = getAllNoteSlugs(locale);
    return slugs.map(slug => ({ locale, slug }));
  });
}

export async function generateMetadata({ params }: NotePageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const note = getNote(locale as Locale, slug);

  if (!note) {
    return { title: 'Not Found' };
  }

  return {
    title: note.meta.title,
    description: `${note.meta.title} - Digital Garden`,
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

  const localeKey = (locale === 'ko' ? 'ko' : 'en') as keyof typeof staticTranslations;
  const t = staticTranslations[localeKey];
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

  const breadcrumbJsonLd = generateBreadcrumbJsonLd({
    items: [
      { name: t.home, url: `${BASE_URL}/${locale}` },
      { name: t.garden, url: `${BASE_URL}/${locale}/garden` },
      { name: note.meta.title, url: `${BASE_URL}/${locale}/garden/${slug}` },
    ],
  });

  return (
    <div className="max-w-3xl mx-auto">
      <JsonLdScript data={breadcrumbJsonLd} />
      <article>
        <header className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={statusVariants[note.meta.status]}>{t.status[note.meta.status]}</Badge>
            <time className="text-sm text-muted-foreground" dateTime={note.meta.created}>
              {formatDateForLocale(note.meta.created, locale).text}
            </time>
            {note.meta.updated && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-sm text-muted-foreground">
                  {t.updated}: {formatDateForLocale(note.meta.updated, locale).text}
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
        linkedNotesLabel={t.linkedNotes}
        linkDirectionLabels={t.linkDirection}
      />

      <nav className="mt-8 pt-8 border-t border-border">
        <Link href="/garden" className="text-sm font-medium hover:underline">
          ← {t.backToGarden}
        </Link>
      </nav>
    </div>
  );
}
