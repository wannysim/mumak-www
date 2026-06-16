/**
 * @jest-environment node
 */
import type { PostMeta } from '@/src/entities/post';
import type { SearchIndex } from '@/src/shared/lib/search';

const mockGetPosts = jest.fn<PostMeta[], [string]>();

jest.mock('@/src/entities/post', () => ({
  getPosts: (locale: string) => mockGetPosts(locale),
}));

// i18n 배럴은 next-intl 클라이언트 네비게이션(ESM)을 끌고 와 node 테스트 환경에서 transform되지
// 않는다. route가 쓰는 값만 가볍게 모킹한다.
jest.mock('@/src/shared/config/i18n', () => ({
  locales: ['ko', 'en'],
  isValidLocale: (locale: string) => locale === 'ko' || locale === 'en',
}));

import { GET, generateStaticParams } from '../route';

function buildContext(locale: string) {
  return { params: Promise.resolve({ locale }) };
}

const samplePosts: PostMeta[] = [
  {
    slug: 'hello-essay',
    title: 'Hello Essay',
    date: '2026-01-01',
    description: 'My first essay',
    category: 'essay',
    tags: ['intro'],
    readingTime: 1,
  },
  {
    slug: 'no-tags',
    title: 'No Tags',
    date: '2026-01-02',
    description: 'A post without tags',
    category: 'articles',
    readingTime: 2,
  },
];

describe('GET /[locale]/search-index.json', () => {
  beforeEach(() => {
    mockGetPosts.mockReset();
  });

  it('prerenders both locales', () => {
    expect(generateStaticParams()).toEqual([{ locale: 'ko' }, { locale: 'en' }]);
  });

  it('returns the search index built from getPosts for a valid locale', async () => {
    mockGetPosts.mockReturnValue(samplePosts);

    const response = await GET(new Request('http://localhost/ko/search-index.json'), buildContext('ko'));
    expect(response.status).toBe(200);

    const body = (await response.json()) as SearchIndex;
    expect(mockGetPosts).toHaveBeenCalledWith('ko');
    expect(body.posts).toEqual([
      {
        title: 'Hello Essay',
        description: 'My first essay',
        category: 'essay',
        slug: 'hello-essay',
        tags: ['intro'],
      },
      {
        title: 'No Tags',
        description: 'A post without tags',
        category: 'articles',
        slug: 'no-tags',
        tags: [],
      },
    ]);
  });

  it('sets a cacheable, public Cache-Control header', async () => {
    mockGetPosts.mockReturnValue(samplePosts);

    const response = await GET(new Request('http://localhost/en/search-index.json'), buildContext('en'));

    expect(response.headers.get('Cache-Control')).toContain('public');
    expect(response.headers.get('Content-Type')).toContain('application/json');
  });

  it('returns 404 for an unknown locale without touching the post loader', async () => {
    const response = await GET(new Request('http://localhost/fr/search-index.json'), buildContext('fr'));

    expect(response.status).toBe(404);
    expect(mockGetPosts).not.toHaveBeenCalled();
  });
});
