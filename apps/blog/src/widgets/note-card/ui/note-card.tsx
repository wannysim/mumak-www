import { getTranslations } from 'next-intl/server';

import { Badge } from '@mumak/ui/components/badge';

import { type NoteMeta, type NoteStatus } from '@/src/entities/note';
import { formatDateForLocale } from '@/src/shared/lib/date';
import { ContentCard } from '@/src/shared/ui/content-card';
import { PostTags } from '@/src/widgets/post-card/ui/post-tags';

interface NoteCardProps {
  note: NoteMeta;
  locale: string;
}

const statusVariants: Record<NoteStatus, 'default' | 'secondary' | 'outline'> = {
  seedling: 'outline',
  budding: 'secondary',
  evergreen: 'default',
};

export async function NoteCard({ note, locale }: NoteCardProps) {
  const t = await getTranslations('garden');
  const date = note.updated || note.created;

  return (
    <ContentCard
      href={`/garden/${note.slug}`}
      title={note.title}
      meta={
        <>
          <Badge variant={statusVariants[note.status]}>{t(`status.${note.status}`)}</Badge>
          <time dateTime={date}>{formatDateForLocale(date, locale).text}</time>
          {note.outgoingLinks.length > 0 && (
            <>
              <span>·</span>
              <span>{note.outgoingLinks.length} links</span>
            </>
          )}
        </>
      }
      tags={note.tags && note.tags.length > 0 ? <PostTags tags={note.tags} basePath="/garden/tags" /> : undefined}
    />
  );
}
