import {
  calculateWordCount,
  getAllPostSlugs,
  getCategories,
  getPage,
  getPost,
  getPosts,
  isValidCategory,
  type PostMeta,
} from '../api/posts';

describe('Posts Data Access Layer', () => {
  describe('getCategories', () => {
    it('should return all valid categories', () => {
      const categories = getCategories();
      expect(categories).toContain('essay');
      expect(categories).toContain('articles');
      expect(categories).toContain('notes');
      expect(categories).toHaveLength(3);
    });
  });

  describe('isValidCategory', () => {
    it('should return true for valid categories', () => {
      expect(isValidCategory('essay')).toBe(true);
      expect(isValidCategory('articles')).toBe(true);
      expect(isValidCategory('notes')).toBe(true);
    });

    it('should return false for invalid categories', () => {
      expect(isValidCategory('invalid')).toBe(false);
      expect(isValidCategory('')).toBe(false);
      expect(isValidCategory('blog')).toBe(false);
    });
  });

  describe('getPosts', () => {
    it('should return posts for a given locale', () => {
      const posts = getPosts('ko');
      expect(Array.isArray(posts)).toBe(true);
    });

    it('should return posts filtered by category', () => {
      const posts = getPosts('ko', 'essay');
      posts.forEach(post => {
        expect(post.category).toBe('essay');
      });
    });

    it('should return posts sorted by date (newest first)', () => {
      const posts = getPosts('ko');
      if (posts.length > 1) {
        for (let i = 0; i < posts.length - 1; i++) {
          const currentPost = posts[i];
          const nextPost = posts[i + 1];
          if (currentPost && nextPost) {
            const currentDate = new Date(currentPost.date);
            const nextDate = new Date(nextPost.date);
            expect(currentDate.getTime()).toBeGreaterThanOrEqual(nextDate.getTime());
          }
        }
      }
    });

    it('should not include draft posts in production', () => {
      const originalEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        writable: true,
        configurable: true,
      });

      const posts = getPosts('ko');
      posts.forEach(post => {
        expect(post.draft).not.toBe(true);
      });

      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalEnv,
        writable: true,
        configurable: true,
      });
    });

    it('returns an empty array when the locale directory does not exist', () => {
      // ko/en만 실제 존재 — 임의의 unknown locale은 getMdxFiles의 not-exists 분기를 탄다.
      const posts = getPosts('zz' as 'ko');
      expect(posts).toEqual([]);
    });

    it('falls back to default category list when given an invalid category', () => {
      const posts = getPosts('ko', 'not-a-real-category');
      // 잘못된 category라도 catch-all 경로(전체 categories 검색)를 타며 결과가 array여야 한다.
      expect(Array.isArray(posts)).toBe(true);
    });

    it('should return PostMeta with required fields', () => {
      const posts = getPosts('ko');
      posts.forEach((post: PostMeta) => {
        expect(post).toHaveProperty('slug');
        expect(post).toHaveProperty('title');
        expect(post).toHaveProperty('date');
        expect(post).toHaveProperty('description');
        expect(post).toHaveProperty('category');
      });
    });

    it('should include readingTime in PostMeta', () => {
      const posts = getPosts('ko');
      posts.forEach((post: PostMeta) => {
        expect(post).toHaveProperty('readingTime');
        expect(typeof post.readingTime).toBe('number');
      });
    });

    it('should have readingTime of at least 1 minute', () => {
      const posts = getPosts('ko');
      posts.forEach((post: PostMeta) => {
        expect(post.readingTime).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('getPost', () => {
    it('should return null for non-existent post', () => {
      const post = getPost('ko', 'essay', 'non-existent-slug');
      expect(post).toBeNull();
    });

    it('should return a post with content for valid slug', () => {
      const posts = getPosts('ko', 'essay');
      if (posts.length > 0) {
        const firstPost = posts[0];
        if (firstPost) {
          const post = getPost('ko', 'essay', firstPost.slug);
          expect(post).not.toBeNull();
          expect(post).toHaveProperty('content');
          expect(post).toHaveProperty('meta');
        }
      }
    });

    it('should return null for invalid category', () => {
      const post = getPost('ko', 'invalid-category', 'some-slug');
      expect(post).toBeNull();
    });

    it('returns null for a missing file even when the category is valid', () => {
      const post = getPost('ko', 'essay', 'definitely-not-a-real-slug');
      expect(post).toBeNull();
    });

    it('blocks draft posts in production', () => {
      const originalEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        writable: true,
        configurable: true,
      });

      const posts = getPosts('ko', 'essay');
      const draftPost = posts.find(p => p.draft);

      // 운영 빌드에서 draft를 직접 호출해도 차단되어야 한다 (draft가 있을 때만 검증).
      if (draftPost) {
        expect(getPost('ko', 'essay', draftPost.slug)).toBeNull();
      }

      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalEnv,
        writable: true,
        configurable: true,
      });
    });

    it('should include readingTime in post meta', () => {
      const posts = getPosts('ko', 'essay');
      if (posts.length > 0) {
        const firstPost = posts[0];
        if (firstPost) {
          const post = getPost('ko', 'essay', firstPost.slug);
          expect(post).not.toBeNull();
          expect(post?.meta).toHaveProperty('readingTime');
          expect(typeof post?.meta.readingTime).toBe('number');
          expect(post?.meta.readingTime).toBeGreaterThanOrEqual(1);
        }
      }
    });
  });

  describe('getAllPostSlugs', () => {
    it('should return an array of slug objects', () => {
      const slugs = getAllPostSlugs('ko');
      expect(Array.isArray(slugs)).toBe(true);
    });

    it('should return objects with category and slug properties', () => {
      const slugs = getAllPostSlugs('ko');
      slugs.forEach(item => {
        expect(item).toHaveProperty('category');
        expect(item).toHaveProperty('slug');
        expect(typeof item.category).toBe('string');
        expect(typeof item.slug).toBe('string');
      });
    });

    it('should return slugs for all categories', () => {
      const slugs = getAllPostSlugs('ko');
      const categories = new Set(slugs.map(s => s.category));

      // 적어도 하나의 카테고리에 포스트가 있어야 함
      if (slugs.length > 0) {
        expect(categories.size).toBeGreaterThan(0);
      }
    });

    it('should work for both locales', () => {
      const koSlugs = getAllPostSlugs('ko');
      const enSlugs = getAllPostSlugs('en');

      expect(Array.isArray(koSlugs)).toBe(true);
      expect(Array.isArray(enSlugs)).toBe(true);
    });

    it('should not include .mdx extension in slug', () => {
      const slugs = getAllPostSlugs('ko');
      slugs.forEach(item => {
        expect(item.slug).not.toContain('.mdx');
      });
    });
  });

  describe('getPage', () => {
    it('should return page content for existing page', () => {
      const page = getPage('ko', 'now');

      if (page) {
        expect(page).toHaveProperty('meta');
        expect(page).toHaveProperty('content');
        expect(page.meta).toHaveProperty('title');
        expect(page.meta).toHaveProperty('description');
        expect(typeof page.content).toBe('string');
      }
    });

    it('should return null for non-existent page', () => {
      const page = getPage('ko', 'non-existent-page');
      expect(page).toBeNull();
    });

    it('should work for both locales', () => {
      const koPage = getPage('ko', 'now');
      const enPage = getPage('en', 'now');

      // 페이지가 존재한다면 구조 검증
      if (koPage) {
        expect(koPage).toHaveProperty('meta');
        expect(koPage).toHaveProperty('content');
      }
      if (enPage) {
        expect(enPage).toHaveProperty('meta');
        expect(enPage).toHaveProperty('content');
      }
    });

    it('should include lastUpdated in meta if available', () => {
      const page = getPage('ko', 'now');

      if (page && page.meta.lastUpdated) {
        expect(typeof page.meta.lastUpdated).toBe('string');
      }
    });

    it('should return page meta with default values for missing fields', () => {
      const page = getPage('ko', 'now');

      if (page) {
        // title이 없으면 'Untitled', description이 없으면 ''
        expect(typeof page.meta.title).toBe('string');
        expect(typeof page.meta.description).toBe('string');
      }
    });
  });

  describe('calculateWordCount', () => {
    it('should count plain English words', () => {
      expect(calculateWordCount('one two three four five')).toBe(5);
    });

    it('should count each Korean character as one unit', () => {
      // 5자 한글
      expect(calculateWordCount('안녕하세요')).toBe(5);
    });

    it('should sum Korean characters and English words for mixed text', () => {
      // '안녕' (2자) + 3 영단어
      expect(calculateWordCount('안녕 hello world from React')).toBe(2 + 4);
    });

    it('should ignore fenced code blocks', () => {
      const content = `intro paragraph here
\`\`\`ts
const skipped = 'this should not count at all';
\`\`\`
outro paragraph here`;
      const result = calculateWordCount(content);
      // 'intro paragraph here outro paragraph here' = 6 단어
      expect(result).toBe(6);
    });

    it('should strip inline code spans entirely', () => {
      // 'see the' (2) + 'function' (1) = 3 — `helperFn`는 코드라 제외
      expect(calculateWordCount('see the `helperFn` function')).toBe(3);
    });

    it('should return 0 for empty content', () => {
      expect(calculateWordCount('')).toBe(0);
    });

    it('should not count whitespace-only content', () => {
      expect(calculateWordCount('   \n\n   \t  ')).toBe(0);
    });
  });
});
