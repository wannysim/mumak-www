import { getPosts, type PostMeta } from '@/src/entities/post';
import type { Locale } from '@/src/shared/config/i18n';

export interface TagInfo {
  name: string;
  count: number;
  slug: string;
}

export function getAllTags(locale: Locale): TagInfo[] {
  const posts = getPosts(locale);
  const tagMap = new Map<string, number>();

  for (const post of posts) {
    for (const tag of post.tags ?? []) {
      tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(tagMap.entries())
    .map(([name, count]) => ({
      name,
      count,
      slug: encodeURIComponent(name),
    }))
    .toSorted((a, b) => b.count - a.count);
}

export function getPostsByTag(locale: Locale, tag: string): PostMeta[] {
  const posts = getPosts(locale);
  const decodedTag = decodeURIComponent(tag);

  return posts.filter(post => post.tags?.includes(decodedTag));
}

export function isValidTag(locale: Locale, tag: string): boolean {
  const tags = getAllTags(locale);
  const decodedTag = decodeURIComponent(tag);
  return tags.some(t => t.name === decodedTag);
}
