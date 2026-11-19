import { getBlogNavCounts } from '../lib/get-blog-nav-counts';

const mockGetPosts = vi.fn();
const mockGetCategories = vi.fn();
const mockGetAllTags = vi.fn();

vi.mock('@/src/entities/post', () => ({
  getCategories: () => mockGetCategories(),
  getPosts: (locale: string) => mockGetPosts(locale),
}));

vi.mock('@/src/entities/tag', () => ({
  getAllTags: (locale: string) => mockGetAllTags(locale),
}));

describe('getBlogNavCounts', () => {
  beforeEach(() => {
    mockGetPosts.mockReturnValue([
      { category: 'essay' },
      { category: 'articles' },
      { category: 'articles' },
      { category: 'notes' },
    ]);
    mockGetCategories.mockReturnValue(['essay', 'articles', 'notes']);
    mockGetAllTags.mockReturnValue([{ name: 'react' }, { name: 'nextjs' }]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('counts all posts, categories, and tags for the locale', () => {
    expect(getBlogNavCounts('ko')).toEqual({
      all: 4,
      essay: 1,
      articles: 2,
      notes: 1,
      tags: 2,
    });

    expect(mockGetPosts).toHaveBeenCalledWith('ko');
    expect(mockGetAllTags).toHaveBeenCalledWith('ko');
  });
});
