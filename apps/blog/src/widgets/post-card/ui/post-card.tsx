import { BookOpen } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Badge } from '@mumak/ui/components/badge';

import { type PostMeta } from '@/src/entities/post';
import { formatDateForLocale } from '@/src/shared/lib/date';
import { ContentCard } from '@/src/shared/ui/content-card';

import { PostTags } from './post-tags';

interface PostCardProps {
  post: PostMeta;
  locale: string;
  categoryLabel?: string;
  readMoreLabel?: string;
}

export async function PostCard({ post, locale, categoryLabel, readMoreLabel }: PostCardProps) {
  const t = await getTranslations('post');
  const { text, dateTime } = formatDateForLocale(post.date, locale);

  return (
    <ContentCard
      href={`/blog/${post.category}/${post.slug}`}
      title={post.title}
      description={post.description}
      meta={
        <>
          {categoryLabel && <Badge variant="secondary">{categoryLabel}</Badge>}
          <time dateTime={dateTime}>{text}</time>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <BookOpen className="size-3.5" aria-hidden />
            {post.readingTime}
            {t('readingTimeUnit')}
          </span>
        </>
      }
      tags={post.tags && post.tags.length > 0 ? <PostTags tags={post.tags} /> : undefined}
      footer={readMoreLabel && <span className="text-sm font-medium text-foreground">{readMoreLabel} →</span>}
    />
  );
}
