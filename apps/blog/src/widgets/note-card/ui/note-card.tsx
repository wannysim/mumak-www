import { getTranslations } from 'next-intl/server';

import { Badge } from '@mumak/ui/components/badge';

import { type NoteMeta, type NoteStatus } from '@/src/entities/note';
import { Link } from '@/src/shared/config/i18n';
import { formatDateForLocale } from '@/src/shared/lib/date';
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

  return (
    <Link href={`/garden/${note.slug}`} className="block">
      <article className="border border-border rounded-lg p-4 hover:bg-muted/50 active:scale-[0.98] transition-all duration-150">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Badge variant={statusVariants[note.status]}>{t(`status.${note.status}`)}</Badge>
          <time dateTime={note.updated || note.created}>
            {formatDateForLocale(note.updated || note.created, locale).text}
          </time>
          {note.outgoingLinks.length > 0 && (
            <>
              <span>·</span>
              <span>{note.outgoingLinks.length} links</span>
            </>
          )}
        </div>
        <h3 className="text-xl font-semibold mb-2">{note.title}</h3>
        {note.tags && note.tags.length > 0 && (
          <div className="mb-3">
            <PostTags tags={note.tags} basePath="/garden/tags" />
          </div>
        )}
      </article>
    </Link>
  );
}
