import { BookOpen } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Badge } from '@mumak/ui/components/badge';

import { type NoteMeta, type NoteStatus } from '@/src/entities/note';
import { formatDateForLocale } from '@/src/shared/lib/date';
import { ContentCard } from '@/src/shared/ui/content-card';
import { PostTags } from '@/src/widgets/post-card/ui/post-tags';

interface NoteCardProps {
  note: NoteMeta;
  locale: string;
  // 홈처럼 가든 밖의 표면에서는 성장 단계를 감춘다. 실제로 관리되는 축이 아니라서
  // 가든 안에서만 쓰고, 밖에서는 없는 편집 관행을 광고하지 않는다.
  showStatus?: boolean;
}

const statusVariants: Record<NoteStatus, 'default' | 'secondary' | 'outline'> = {
  seedling: 'outline',
  budding: 'secondary',
  evergreen: 'default',
};

export async function NoteCard({ note, locale, showStatus = true }: NoteCardProps) {
  const [t, tPost] = await Promise.all([getTranslations('garden'), getTranslations('post')]);
  const date = note.updated || note.created;

  return (
    <ContentCard
      href={`/garden/${note.slug}`}
      title={note.title}
      description={note.excerpt}
      meta={
        <>
          {showStatus && <Badge variant={statusVariants[note.status]}>{t(`status.${note.status}`)}</Badge>}
          <time dateTime={date}>{formatDateForLocale(date, locale).text}</time>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <BookOpen className="size-3.5" aria-hidden />
            {note.readingTime}
            {tPost('readingTimeUnit')}
          </span>
          {note.outgoingLinks.length > 0 && (
            <>
              <span>·</span>
              <span>{t('linkCount', { count: note.outgoingLinks.length })}</span>
            </>
          )}
        </>
      }
      tags={note.tags && note.tags.length > 0 ? <PostTags tags={note.tags} basePath="/garden/tags" /> : undefined}
    />
  );
}
