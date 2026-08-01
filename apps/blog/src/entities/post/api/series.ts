import type { Locale } from '@/src/shared/config/i18n';

import { getPosts, type PostMeta } from './posts';

export interface SeriesContext {
  /** 시리즈 전체를 part 오름차순으로. 현재 글도 포함한다. */
  parts: PostMeta[];
  current: PostMeta;
  next?: PostMeta;
}

/** 한 시리즈에 속한 글을 part 오름차순으로 돌려준다. */
export function getSeriesPosts(locale: Locale, series: string): PostMeta[] {
  return getPosts(locale)
    .filter(post => post.series === series)
    .toSorted((a, b) => (a.part ?? 0) - (b.part ?? 0));
}

/**
 * 시리즈 글의 앞뒤 문맥. 시리즈가 아니거나 혼자뿐이면 null이다.
 *
 * 혼자인 경우를 걸러내는 이유: draft로 뒤 편을 아직 안 냈거나 한 locale에만 있는
 * 동안 "1/1" 배지가 붙는데, 그건 시리즈라는 정보를 주는 게 아니라 노이즈다.
 */
export function getSeriesContext(locale: Locale, post: PostMeta): SeriesContext | null {
  if (!post.series) {
    return null;
  }

  const parts = getSeriesPosts(locale, post.series);
  const index = parts.findIndex(part => part.category === post.category && part.slug === post.slug);

  if (index === -1 || parts.length < 2) {
    return null;
  }

  return {
    parts,
    current: post,
    next: parts[index + 1],
  };
}
