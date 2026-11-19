import sitemap from '@/app/sitemap';
import { getNotes, getNotesByTag } from '@/src/entities/note';
import { getPosts } from '@/src/entities/post';
import { locales } from '@/src/shared/config/i18n/config';

describe('sitemap', () => {
  let entries: ReturnType<typeof sitemap>;

  // 모든 케이스가 같은 콘텐츠를 검증하므로 전체 가든을 읽는 sitemap() 호출을 공유한다.
  beforeAll(() => {
    entries = sitemap();
  }, 30_000);

  it('should return an array of sitemap entries', () => {
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
  });

  it('should include home pages for all locales', () => {
    for (const locale of locales) {
      const homeEntry = entries.find(entry => entry.url.endsWith(`/${locale}`));
      expect(homeEntry).toBeDefined();
      expect(homeEntry?.priority).toBe(1);
      expect(homeEntry?.changeFrequency).toBe('weekly');
    }
  });

  it('should include blog and category pages', () => {
    const categories = ['essay', 'articles', 'notes'];

    for (const locale of locales) {
      // Check blog main page
      const blogEntry = entries.find(
        entry => entry.url.includes(`/${locale}/blog`) && !entry.url.includes(`/${locale}/blog/`)
      );
      expect(blogEntry).toBeDefined();
      expect(blogEntry?.priority).toBe(0.9);

      // Check category pages
      for (const category of categories) {
        const categoryEntry = entries.find(entry => entry.url.includes(`/${locale}/blog/${category}`));
        expect(categoryEntry).toBeDefined();
        expect(categoryEntry?.priority).toBe(0.8);
      }
    }
  });

  it('should have valid sitemap entry structure', () => {
    entries.forEach(entry => {
      expect(entry).toHaveProperty('url');
      expect(entry).toHaveProperty('lastModified');
      expect(entry).toHaveProperty('changeFrequency');
      expect(entry).toHaveProperty('priority');
      expect(typeof entry.url).toBe('string');
      expect(entry.url).toMatch(/^https?:\/\//);
    });
  });

  it('should include post pages with lower priority', () => {
    const postEntries = entries.filter(entry => entry.priority === 0.6 && entry.changeFrequency === 'monthly');

    // 포스트 페이지가 있다면 검증
    if (postEntries.length > 0) {
      postEntries.forEach(entry => {
        // URL 패턴: /{locale}/blog/{category}/{slug}
        expect(entry.url).toMatch(/\/blog\/[^/]+\/[^/]+$/);
      });
    }
  });

  it('should have lastModified as Date instance', () => {
    entries.forEach(entry => {
      expect(entry.lastModified).toBeInstanceOf(Date);
    });
  });

  describe('hreflang alternates', () => {
    it('should attach languages alternates for every locale to each entry', () => {
      entries.forEach(entry => {
        expect(entry.alternates?.languages).toBeDefined();
        for (const locale of locales) {
          expect(entry.alternates?.languages?.[locale]).toMatch(new RegExp(`/${locale}(/|$)`));
        }
      });
    });

    it('should cross-reference ko and en URLs for the same path', () => {
      const koHome = entries.find(entry => entry.url.endsWith('/ko'));

      expect(koHome?.alternates?.languages?.ko).toBe(koHome?.url);
      expect(koHome?.alternates?.languages?.en).toBe(koHome?.url?.replace(/\/ko$/, '/en'));
    });

    it('should declare x-default pointing to the default locale URL', () => {
      const enBlog = entries.find(entry => entry.url.endsWith('/en/blog'));

      expect(enBlog?.alternates?.languages?.['x-default']).toBe(enBlog?.url?.replace(/\/en\/blog$/, '/ko/blog'));
    });
  });

  describe('garden pages', () => {
    it('should include garden main pages for all locales', () => {
      for (const locale of locales) {
        const gardenEntry = entries.find(
          entry => entry.url.includes(`/${locale}/garden`) && !entry.url.includes(`/${locale}/garden/`)
        );
        expect(gardenEntry).toBeDefined();
        expect(gardenEntry?.priority).toBe(0.8);
        expect(gardenEntry?.changeFrequency).toBe('weekly');
      }
    });

    it('should include garden tags page for all locales', () => {
      for (const locale of locales) {
        const tagsEntry = entries.find(
          entry => entry.url.includes(`/${locale}/garden/tags`) && !entry.url.includes(`/${locale}/garden/tags/`)
        );
        expect(tagsEntry).toBeDefined();
        expect(tagsEntry?.priority).toBe(0.6);
      }
    });

    it('should include garden status pages for all locales', () => {
      const statuses = ['seedling', 'budding', 'evergreen'];

      for (const locale of locales) {
        for (const status of statuses) {
          const statusEntry = entries.find(entry => entry.url.includes(`/${locale}/garden/status/${status}`));
          expect(statusEntry).toBeDefined();
          expect(statusEntry?.priority).toBe(0.5);
        }
      }
    });

    it('should include garden note pages', () => {
      const gardenNoteEntries = entries.filter(
        entry =>
          entry.url.includes('/garden/') &&
          !entry.url.includes('/garden/tags') &&
          !entry.url.includes('/garden/status') &&
          entry.priority === 0.6 &&
          entry.changeFrequency === 'weekly'
      );

      // 노트 페이지가 있다면 검증
      if (gardenNoteEntries.length > 0) {
        gardenNoteEntries.forEach(entry => {
          // URL 패턴: /{locale}/garden/{slug}
          expect(entry.url).toMatch(/\/garden\/[^/]+$/);
        });
      }
    });
  });

  describe('lastModified accuracy', () => {
    function entryByUrlSuffix(suffix: string) {
      return entries.find(entry => entry.url.endsWith(suffix));
    }

    function asDate(entry: { lastModified?: string | Date } | undefined) {
      return entry?.lastModified instanceof Date ? entry.lastModified : null;
    }

    it('should use post frontmatter date (or updated) as post entry lastModified', () => {
      const posts = getPosts('en');

      if (posts.length === 0) {
        return;
      }

      for (const post of posts.slice(0, 3)) {
        const entry = entryByUrlSuffix(`/en/blog/${post.category}/${post.slug}`);
        expect(entry).toBeDefined();
        const expected = new Date(post.updated ?? post.date);
        expect(asDate(entry)?.getTime()).toBe(expected.getTime());
      }
    });

    it('should use note updated || created as garden note entry lastModified', () => {
      const notes = getNotes('en');

      if (notes.length === 0) {
        return;
      }

      for (const note of notes.slice(0, 3)) {
        const entry = entryByUrlSuffix(`/en/garden/${note.slug}`);
        expect(entry).toBeDefined();
        const expected = new Date(note.updated ?? note.created);
        expect(asDate(entry)?.getTime()).toBe(expected.getTime());
      }
    });

    it('should use max of category posts dates for category entry lastModified', () => {
      const allPosts = getPosts('en');

      if (allPosts.length === 0) {
        return;
      }

      const grouped = new Map<string, number>();
      for (const post of allPosts) {
        const date = new Date(post.updated ?? post.date).getTime();
        grouped.set(post.category, Math.max(grouped.get(post.category) ?? 0, date));
      }

      for (const [category, expectedMs] of grouped) {
        const entry = entryByUrlSuffix(`/en/blog/${category}`);
        expect(entry).toBeDefined();
        expect(asDate(entry)?.getTime()).toBe(expectedMs);
      }
    });

    it('should use max of tagged note dates for garden tag entry lastModified', () => {
      const notes = getNotes('en');

      if (notes.length === 0) {
        return;
      }

      const sampleTag = notes.flatMap(note => note.tags ?? [])[0];
      if (!sampleTag) {
        return;
      }

      const tagged = getNotesByTag('en', sampleTag);
      if (tagged.length === 0) {
        return;
      }

      const expectedMs = Math.max(...tagged.map(note => new Date(note.updated ?? note.created).getTime()));
      const entry = entryByUrlSuffix(`/en/garden/tags/${sampleTag}`);
      expect(entry).toBeDefined();
      expect(asDate(entry)?.getTime()).toBe(expectedMs);
    });

    it('should encode garden tag URLs using tag.name (not the tag object)', () => {
      const tagEntries = entries.filter(entry => /\/garden\/tags\/[^/]+$/.test(entry.url));

      tagEntries.forEach(entry => {
        expect(entry.url).not.toContain('[object Object]');
      });
    });
  });
});
