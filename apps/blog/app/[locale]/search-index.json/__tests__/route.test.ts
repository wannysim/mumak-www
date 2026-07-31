/**
 * @jest-environment node
 */
import type { NoteMeta } from '@/src/entities/note';
import type { PostMeta } from '@/src/entities/post';
import type { SearchIndex } from '@/src/shared/lib/search';

const mockGetPosts = jest.fn<PostMeta[], [string]>();
const mockGetNotes = jest.fn<NoteMeta[], [string]>();

jest.mock('@/src/entities/post', () => ({
  getPosts: (locale: string) => mockGetPosts(locale),
}));

jest.mock('@/src/entities/note', () => ({
  getNotes: (locale: string) => mockGetNotes(locale),
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

const sampleNotes: NoteMeta[] = [
  {
    slug: 'first-note',
    title: 'First Note',
    category: 'resources',
    created: '2026-01-01',
    updated: '2026-02-01',
    status: 'seedling',
    tags: ['idea'],
    outgoingLinks: [],
    excerpt: 'A note excerpt',
    readingTime: 1,
  },
  {
    slug: 'bare-note',
    title: 'Bare Note',
    category: 'garden',
    created: '2026-01-03',
    status: 'budding',
    outgoingLinks: [],
    readingTime: 1,
  },
];

describe('GET /[locale]/search-index.json', () => {
  beforeEach(() => {
    mockGetPosts.mockReset();
    mockGetNotes.mockReset();
    mockGetPosts.mockReturnValue([]);
    mockGetNotes.mockReturnValue([]);
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

  // 전역 검색은 헤더에 마운트되어 가든 레이아웃 payload를 쓸 수 없다. 노트가 이 인덱스에서
  // 빠지면 홈·소개 같은 페이지에서 노트를 아예 찾을 수 없게 된다.
  it('includes garden notes so the header palette can search both sections', async () => {
    mockGetPosts.mockReturnValue(samplePosts);
    mockGetNotes.mockReturnValue(sampleNotes);

    const response = await GET(new Request('http://localhost/ko/search-index.json'), buildContext('ko'));

    const body = (await response.json()) as SearchIndex;
    expect(mockGetNotes).toHaveBeenCalledWith('ko');
    expect(body.notes).toEqual([
      { title: 'First Note', excerpt: 'A note excerpt', slug: 'first-note', tags: ['idea'] },
      { title: 'Bare Note', excerpt: '', slug: 'bare-note', tags: [] },
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
    expect(mockGetNotes).not.toHaveBeenCalled();
  });
});
