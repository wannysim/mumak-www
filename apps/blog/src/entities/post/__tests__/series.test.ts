import type { PostMeta } from '../api/posts';
import { getSeriesContext, getSeriesPosts } from '../api/series';

function post(overrides: Partial<PostMeta> & Pick<PostMeta, 'slug'>): PostMeta {
  return {
    title: overrides.slug,
    date: '2026-01-01',
    description: '',
    category: 'articles',
    readingTime: 5,
    ...overrides,
  };
}

// getPosts는 최신순이라, part 오름차순 정렬이 실제로 일어나는지 보려면
// 뒤 편이 먼저 오는 상태로 둔다.
const posts: PostMeta[] = [
  post({ slug: 'part-3', series: 'Expo', part: 3, date: '2026-01-03' }),
  post({ slug: 'part-2', series: 'Expo', part: 2, date: '2026-01-02' }),
  post({ slug: 'part-1', series: 'Expo', part: 1, date: '2026-01-01' }),
  post({ slug: 'lonely', series: 'Solo', part: 1 }),
  post({ slug: 'standalone' }),
];

jest.mock('../api/posts', () => ({
  ...jest.requireActual('../api/posts'),
  getPosts: jest.fn(() => posts),
}));

function find(slug: string): PostMeta {
  const found = posts.find(candidate => candidate.slug === slug);
  if (!found) throw new Error(`fixture missing: ${slug}`);
  return found;
}

describe('getSeriesPosts', () => {
  it('날짜가 아니라 part 오름차순으로 돌려준다', () => {
    expect(getSeriesPosts('ko', 'Expo').map(p => p.slug)).toEqual(['part-1', 'part-2', 'part-3']);
  });

  it('없는 시리즈는 빈 배열이다', () => {
    expect(getSeriesPosts('ko', 'Nope')).toEqual([]);
  });
});

describe('getSeriesContext', () => {
  it('가운데 편은 앞뒤가 모두 있다', () => {
    const context = getSeriesContext('ko', find('part-2'));

    expect(context?.previous?.slug).toBe('part-1');
    expect(context?.next?.slug).toBe('part-3');
    expect(context?.parts).toHaveLength(3);
  });

  it('첫 편에는 이전이 없다', () => {
    const context = getSeriesContext('ko', find('part-1'));

    expect(context?.previous).toBeUndefined();
    expect(context?.next?.slug).toBe('part-2');
  });

  it('마지막 편에는 다음이 없다', () => {
    const context = getSeriesContext('ko', find('part-3'));

    expect(context?.previous?.slug).toBe('part-2');
    expect(context?.next).toBeUndefined();
  });

  it('시리즈가 아닌 글은 null이다', () => {
    expect(getSeriesContext('ko', find('standalone'))).toBeNull();
  });

  it('편이 하나뿐이면 null이다 — "1/1" 배지는 정보가 아니라 노이즈다', () => {
    expect(getSeriesContext('ko', find('lonely'))).toBeNull();
  });
});
