import type { PostMeta } from '../api/posts';
import { getRelatedPosts } from '../api/related';

const posts: PostMeta[] = [
  {
    slug: 'current',
    title: 'Current',
    date: '2026-01-10',
    description: '',
    category: 'articles',
    tags: ['react', 'nextjs'],
    readingTime: 5,
    outgoingHrefs: [],
  },
  {
    slug: 'two-shared-tags',
    title: 'Two shared tags',
    date: '2020-01-01',
    description: '',
    category: 'essay',
    tags: ['react', 'nextjs', 'other'],
    readingTime: 5,
    outgoingHrefs: [],
  },
  {
    slug: 'one-shared-tag',
    title: 'One shared tag',
    date: '2026-01-09',
    description: '',
    category: 'articles',
    tags: ['react'],
    readingTime: 5,
    outgoingHrefs: [],
  },
  {
    slug: 'no-shared-tag-same-category',
    title: 'No shared tag, same category',
    date: '2020-01-01',
    description: '',
    category: 'articles',
    tags: ['unrelated'],
    readingTime: 5,
    outgoingHrefs: [],
  },
  {
    slug: 'no-shared-tag-other-category-recent',
    title: 'No shared tag, other category, recent',
    date: '2026-01-08',
    description: '',
    category: 'notes',
    readingTime: 5,
    outgoingHrefs: [],
  },
  {
    slug: 'current',
    title: 'Same slug in another category',
    date: '2026-01-07',
    description: '',
    category: 'notes',
    tags: ['react'],
    readingTime: 5,
    outgoingHrefs: [],
  },
];

jest.mock('../api/posts', () => ({
  ...jest.requireActual('../api/posts'),
  getPosts: jest.fn(() => posts),
}));

function currentPost(): PostMeta {
  const post = posts[0];
  if (!post) throw new Error('fixture missing');
  return post;
}

function slugsOf(result: PostMeta[]): string[] {
  return result.map(post => `${post.category}/${post.slug}`);
}

describe('getRelatedPosts', () => {
  it('공유 태그가 많은 글을 먼저 제안한다', () => {
    const related = getRelatedPosts('ko', currentPost(), 2);

    expect(slugsOf(related)).toEqual(['essay/two-shared-tags', 'articles/one-shared-tag']);
  });

  it('현재 글 자신은 제외한다', () => {
    const related = getRelatedPosts('ko', currentPost(), 10);

    expect(slugsOf(related)).not.toContain('articles/current');
  });

  it('slug가 같아도 카테고리가 다르면 다른 글로 본다', () => {
    const related = getRelatedPosts('ko', currentPost(), 10);

    expect(slugsOf(related)).toContain('notes/current');
  });

  it('공유 태그 수가 같으면 같은 카테고리를 우선한다', () => {
    // one-shared-tag(articles)와 notes/current 둘 다 'react' 하나만 공유한다.
    const related = getRelatedPosts('ko', currentPost(), 10);
    const ranks = slugsOf(related);

    expect(ranks.indexOf('articles/one-shared-tag')).toBeLessThan(ranks.indexOf('notes/current'));
  });

  it('겹치는 태그가 없어도 같은 카테고리의 최신 글로 결과를 채운다', () => {
    const noTagPost: PostMeta = { ...currentPost(), slug: 'tagless', tags: undefined };
    const related = getRelatedPosts('ko', noTagPost, 3);

    // articles 3편이 최신순으로 먼저 오고, 다른 카테고리는 그 뒤로 밀린다.
    expect(slugsOf(related)).toEqual([
      'articles/current',
      'articles/one-shared-tag',
      'articles/no-shared-tag-same-category',
    ]);
  });

  it('limit만큼만 돌려준다', () => {
    expect(getRelatedPosts('ko', currentPost(), 2)).toHaveLength(2);
  });

  it('기본 limit은 3이다', () => {
    expect(getRelatedPosts('ko', currentPost())).toHaveLength(3);
  });
});
