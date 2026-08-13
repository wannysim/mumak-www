import { getTranslations } from 'next-intl/server';

import { getCategoryLabel, type Category, type PostMeta } from '@/src/entities/post';
import { Link, type Locale } from '@/src/shared/config/i18n';
import { ArrowLink } from '@/src/shared/ui';

interface NextReadingProps {
  posts: PostMeta[];
  locale: Locale;
  /** 마무리 링크가 돌아갈 현재 글의 카테고리. */
  category: Category;
  /** 시리즈 글이면 다음 편. 태그 기반 제안보다 강한 신호라 맨 위에 따로 놓는다. */
  seriesNext?: PostMeta;
}

const HEADING_ID = 'next-reading-heading';

/**
 * 글 끝의 착지 지점.
 *
 * 검색으로 들어온 독자가 글을 다 읽은 순간이 재방문 확률이 가장 높은 지점인데, 여기서
 * 시간순 전체 목록으로만 보내면 그 신호를 버리게 된다. 그래서 이어 읽을 글을 먼저
 * 제안하고 목록 링크는 그 아래 보조 경로로 남긴다.
 *
 * 마크업은 카드가 아니라 가든의 연결 노트 목록과 같은 nav + ul이다. 카드(ContentCard)는
 * `<article>`을 만드는데 상세 페이지에는 본문 `<article>`이 이미 있어서 landmark가
 * 중복되고, 본문을 다 읽은 뒤 붙는 블록이라 목록 페이지와 같은 밀도로 쌓으면 무겁다.
 */
export async function NextReading({ posts, locale, category, seriesNext }: NextReadingProps) {
  const tPost = await getTranslations('post');

  if (posts.length === 0 && !seriesNext) {
    return null;
  }

  // 행 전체가 하나의 링크다. 제목만 링크로 두면 타깃이 한 줄 높이로 얇아진다.
  const row = (post: PostMeta, badge?: string) => (
    <li key={`${post.category}-${post.slug}`}>
      <Link
        href={`/blog/${post.category}/${post.slug}`}
        className="group -mx-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md px-2 py-2 transition-colors hover:bg-muted/60"
      >
        {badge && (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-accent-foreground">
            {badge}
          </span>
        )}
        {/* 본문 MDX 링크·가든 연결 노트와 같은 토큰(라이트 7.92:1 / 다크 11.58:1). */}
        <span className="text-accent-foreground underline-offset-4 group-hover:underline">{post.title}</span>
        <span className="text-xs text-muted-foreground">
          {getCategoryLabel(post.category, locale)} · {post.readingTime}
          {tPost('readingTimeUnit')}
        </span>
      </Link>
    </li>
  );

  return (
    <nav data-slot="next-reading" aria-labelledby={HEADING_ID} className="mt-12 border-t border-border pt-8">
      <h2 id={HEADING_ID} className="mb-3 text-lg font-semibold">
        {tPost('nextReading')}
      </h2>

      <ul>
        {seriesNext && row(seriesNext, tPost('nextInSeries'))}
        {posts.map(post => row(post))}
      </ul>

      <div className="mt-5">
        <ArrowLink href={`/blog/${category}`}>
          {tPost('moreInCategory', { category: getCategoryLabel(category, locale) })}
        </ArrowLink>
      </div>
    </nav>
  );
}
