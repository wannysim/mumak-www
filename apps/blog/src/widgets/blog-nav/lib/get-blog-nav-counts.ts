import { getCategories, getPosts } from '@/src/entities/post';
import { getAllTags } from '@/src/entities/tag';
import { type Locale } from '@/src/shared/config/i18n';

// ContentSegmentNav item key별 카운트. key는 BlogNav가 만드는 item key와 맞춘다
// ('all' | category | 'tags'). 서버에서 계산해 client BlogNav에 prop으로 내려준다.
export function getBlogNavCounts(locale: Locale): Record<string, number> {
  const posts = getPosts(locale);

  const counts: Record<string, number> = { all: posts.length };
  for (const category of getCategories()) {
    counts[category] = posts.filter(post => post.category === category).length;
  }
  counts.tags = getAllTags(locale).length;

  return counts;
}
