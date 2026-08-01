import type { Locale } from '@/src/shared/config/i18n';

import { getPosts, type PostMeta } from './posts';

const DEFAULT_LIMIT = 3;

function countSharedTags(tags: string[], other: PostMeta): number {
  return other.tags?.filter(tag => tags.includes(tag)).length ?? 0;
}

function isSamePost(a: PostMeta, b: PostMeta): boolean {
  return a.category === b.category && a.slug === b.slug;
}

/**
 * 글 끝에서 이어 읽을 글을 고른다.
 *
 * 정렬 축은 셋이다: 공유 태그 수 → 같은 카테고리 → 최신순. 겹치는 태그가 없어도 같은
 * 카테고리의 최신 글로 자연히 채워지므로 결과가 비지 않는다. 글이 수십 편 규모라
 * 교집합 크기 이상의 점수식(TF-IDF 등)을 둘 이유가 없다.
 *
 * getPosts가 이미 React.cache로 감싸져 있고 이 함수는 페이지당 한 번만 불리므로
 * 여기에 캐시를 더 씌우지 않는다.
 */
export function getRelatedPosts(locale: Locale, post: PostMeta, limit: number = DEFAULT_LIMIT): PostMeta[] {
  const tags = post.tags ?? [];

  return getPosts(locale)
    .filter(candidate => !isSamePost(candidate, post))
    .map(candidate => ({ candidate, sharedTags: countSharedTags(tags, candidate) }))
    .toSorted(
      (a, b) =>
        b.sharedTags - a.sharedTags ||
        Number(b.candidate.category === post.category) - Number(a.candidate.category === post.category) ||
        new Date(b.candidate.date).getTime() - new Date(a.candidate.date).getTime()
    )
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}
