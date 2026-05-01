import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { buildAlternates } from '@/src/app/seo';
import { getAllNoteTags, getNotesByTag } from '@/src/entities/note';
import { locales, type Locale } from '@/src/shared/config/i18n';
import { GardenNav } from '@/src/widgets/garden-nav';
import { NoteCard } from '@/src/widgets/note-card';
import { TagCloud } from '@/src/widgets/tag-cloud';

interface GardenTagPageProps {
  params: Promise<{ locale: string; tag: string }>;
}

export function generateStaticParams() {
  return locales.flatMap(locale => {
    const tags = getAllNoteTags(locale);
    return tags.map(tag => ({ locale, tag: encodeURIComponent(tag.name) }));
  });
}

export async function generateMetadata({ params }: GardenTagPageProps): Promise<Metadata> {
  const { locale, tag } = await params;
  const t = await getTranslations({ locale, namespace: 'garden.tags' });
  const decodedTag = decodeURIComponent(tag);

  return {
    title: t('tagTitle', { tag: decodedTag }),
    description: t('tagDescription', { tag: decodedTag }),
    alternates: buildAlternates({ locale, path: `/garden/tags/${tag}` }),
  };
}

export default async function GardenTagPage({ params }: GardenTagPageProps) {
  const { locale, tag } = await params;
  setRequestLocale(locale);

  const decodedTag = decodeURIComponent(tag);
  const t = await getTranslations('garden.tags');
  const tGarden = await getTranslations('garden');
  const tCommon = await getTranslations('common');
  const notes = getNotesByTag(locale as Locale, decodedTag);
  const allTags = getAllNoteTags(locale as Locale).map(tagItem => ({
    ...tagItem,
    slug: encodeURIComponent(tagItem.name),
  }));

  if (notes.length === 0) {
    notFound();
  }

  const statusLabels = {
    seedling: tGarden('status.seedling'),
    budding: tGarden('status.budding'),
    evergreen: tGarden('status.evergreen'),
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold mb-2">{t('tagTitle', { tag: decodedTag })}</h1>
        <p className="text-muted-foreground">{t('noteCount', { count: notes.length })}</p>
      </header>

      <GardenNav allLabel={tCommon('all')} statusLabels={statusLabels} tagsLabel={tCommon('tags')} />

      <TagCloud tags={allTags.slice(0, 10)} activeTag={decodedTag} basePath="/garden/tags" showCount />

      <section className="space-y-4">
        {notes.map(note => (
          <NoteCard key={note.slug} note={note} locale={locale} />
        ))}
      </section>
    </div>
  );
}
