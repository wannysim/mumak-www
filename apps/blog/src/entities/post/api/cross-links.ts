import type { Locale } from '@/src/shared/config/i18n';

import { getPosts, type PostMeta } from './posts';

/** 상세 페이지 경로. outgoingHrefs가 정규화되는 형태와 같아야 한다. */
export function toPostHref(post: Pick<PostMeta, 'category' | 'slug'>): string {
  return `/blog/${post.category}/${post.slug}`;
}

/**
 * 주어진 경로를 본문에서 가리키는 글들.
 *
 * entities/note의 getNotesLinkingTo와 대칭이다. 두 엔티티가 서로를 import하지
 * 않고도(같은 레이어 cross-import 금지) 각자 "누가 이 경로를 가리키는가"만
 * 답하면, app 레이어에서 양방향 연결이 완성된다.
 */
export function getPostsLinkingTo(locale: Locale, href: string): PostMeta[] {
  return getPosts(locale).filter(post => post.outgoingHrefs.includes(href));
}

/** 경로 목록을 글로 되돌린다. 블로그 글을 가리키지 않는 경로는 조용히 버린다. */
export function getPostsByHrefs(locale: Locale, hrefs: string[]): PostMeta[] {
  const byHref = new Map(getPosts(locale).map(post => [toPostHref(post), post]));

  return hrefs.map(href => byHref.get(href)).filter((post): post is PostMeta => post !== undefined);
}
