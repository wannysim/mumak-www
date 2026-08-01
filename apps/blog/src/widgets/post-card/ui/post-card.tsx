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
          {/* 목록은 최신순이라 시리즈가 마지막 편부터 노출된다. 배지가 없으면
              리스트로 들어온 독자가 결말부터 읽기 시작한다. */}
          {post.series && post.part && (
            <Badge variant="outline">
              {post.series} {t('seriesPart', { part: post.part })}
            </Badge>
          )}
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
