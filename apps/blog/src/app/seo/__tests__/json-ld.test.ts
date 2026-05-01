import type { NoteMeta } from '@/src/entities/note';
import type { PostMeta } from '@/src/entities/post';

import {
  generateBlogPostingJsonLd,
  generateBreadcrumbJsonLd,
  generateGardenNoteJsonLd,
  generateSiteNavigationJsonLd,
  generateWebSiteJsonLd,
} from '../json-ld';

describe('json-ld', () => {
  describe('generateWebSiteJsonLd', () => {
    it('should generate WebSite schema for Korean locale', () => {
      const result = generateWebSiteJsonLd({ locale: 'ko' });

      expect(result['@context']).toBe('https://schema.org');
      expect(result['@type']).toBe('WebSite');
      expect(result['@id']).toContain('/#website');
      expect(result.name).toBe('Wan Sim');
      expect(result.url).toContain('/ko');
      expect(result.inLanguage).toBe('ko-KR');
      expect(result.author['@type']).toBe('Person');
      expect(result.author.name).toBe('Wan Sim');
    });

    it('should generate WebSite schema for English locale', () => {
      const result = generateWebSiteJsonLd({ locale: 'en' });

      expect(result.url).toContain('/en');
      expect(result.inLanguage).toBe('en-US');
    });

    it('should include SearchAction for sitelinks searchbox', () => {
      const result = generateWebSiteJsonLd({ locale: 'ko' });

      expect(result.potentialAction['@type']).toBe('SearchAction');
      expect(result.potentialAction.target.urlTemplate).toContain('/ko/blog?q=');
      expect(result.potentialAction['query-input']).toBe('required name=search_term_string');
    });
  });

  describe('generateSiteNavigationJsonLd', () => {
    it('should generate SiteNavigationElement schema for Korean locale', () => {
      const result = generateSiteNavigationJsonLd({ locale: 'ko' });

      expect(result['@context']).toBe('https://schema.org');
      expect(result['@type']).toBe('SiteNavigationElement');
      expect(result.hasPart).toHaveLength(4);
      expect(result.hasPart![0]!.name).toBe('블로그');
      expect(result.hasPart![1]!.name).toBe('가든');
    });

    it('should generate SiteNavigationElement schema for English locale', () => {
      const result = generateSiteNavigationJsonLd({ locale: 'en' });

      expect(result.hasPart![0]!.name).toBe('Blog');
      expect(result.hasPart![1]!.name).toBe('Garden');
    });
  });

  describe('generateBreadcrumbJsonLd', () => {
    it('should generate BreadcrumbList schema', () => {
      const result = generateBreadcrumbJsonLd({
        items: [
          { name: 'Home', url: 'https://example.com' },
          { name: 'Blog', url: 'https://example.com/blog' },
          { name: 'Post', url: 'https://example.com/blog/post' },
        ],
      });

      expect(result['@context']).toBe('https://schema.org');
      expect(result['@type']).toBe('BreadcrumbList');
      expect(result.itemListElement).toHaveLength(3);
      expect(result.itemListElement[0]!.position).toBe(1);
      expect(result.itemListElement[0]!.name).toBe('Home');
      expect(result.itemListElement[2]!.position).toBe(3);
    });
  });

  describe('generateBlogPostingJsonLd', () => {
    const mockPost: PostMeta = {
      title: 'Test Post Title',
      description: 'Test post description',
      date: '2024-01-15',
      slug: 'test-post',
      category: 'articles',
      readingTime: 5,
    };

    it('should generate BlogPosting schema', () => {
      const result = generateBlogPostingJsonLd({
        post: mockPost,
        locale: 'ko',
        category: 'articles',
      });

      expect(result['@context']).toBe('https://schema.org');
      expect(result['@type']).toBe('BlogPosting');
      expect(result.headline).toBe('Test Post Title');
      expect(result.description).toBe('Test post description');
      expect(result.datePublished).toBe('2024-01-15');
      expect(result.dateModified).toBe('2024-01-15');
      expect(result.url).toContain('/ko/blog/articles/test-post');
      expect(result.inLanguage).toBe('ko-KR');
      expect(result.articleSection).toBe('articles');
    });

    it('should use updated date as dateModified when provided', () => {
      const result = generateBlogPostingJsonLd({
        post: { ...mockPost, updated: '2024-06-20' },
        locale: 'ko',
        category: 'articles',
      });

      expect(result.datePublished).toBe('2024-01-15');
      expect(result.dateModified).toBe('2024-06-20');
    });

    it('should include keywords from tags when present', () => {
      const result = generateBlogPostingJsonLd({
        post: { ...mockPost, tags: ['react', 'next-js'] },
        locale: 'ko',
        category: 'articles',
      });

      expect(result.keywords).toBe('react, next-js');
    });

    it('should omit keywords when tags are empty', () => {
      const result = generateBlogPostingJsonLd({
        post: { ...mockPost, tags: [] },
        locale: 'ko',
        category: 'articles',
      });

      expect(result.keywords).toBeUndefined();
    });

    it('should include OG image URL', () => {
      const result = generateBlogPostingJsonLd({
        post: mockPost,
        locale: 'en',
        category: 'essay',
      });

      expect(result.image).toEqual([expect.stringContaining('/en/blog/essay/test-post/opengraph-image')]);
    });

    it('should include wordCount when provided', () => {
      const result = generateBlogPostingJsonLd({
        post: mockPost,
        locale: 'ko',
        category: 'articles',
        wordCount: 1234,
      });

      expect(result.wordCount).toBe(1234);
    });

    it('should reference author by @id and publisher reuses the same entity', () => {
      const result = generateBlogPostingJsonLd({
        post: mockPost,
        locale: 'ko',
        category: 'articles',
      });

      expect(result.author).toMatchObject({
        '@type': 'Person',
        '@id': expect.stringContaining('/#author'),
        name: 'Wan Sim',
      });
      expect(result.publisher).toEqual({ '@id': expect.stringContaining('/#author') });
    });

    it('should include mainEntityOfPage', () => {
      const result = generateBlogPostingJsonLd({
        post: mockPost,
        locale: 'ko',
        category: 'articles',
      });

      expect(result.mainEntityOfPage).toEqual({
        '@type': 'WebPage',
        '@id': expect.stringContaining('/ko/blog/articles/test-post'),
      });
    });
  });

  describe('generateGardenNoteJsonLd', () => {
    const mockNote: NoteMeta = {
      slug: 'mind-and-machines',
      title: 'Mind and Machines',
      created: '2025-03-01',
      status: 'budding',
      category: 'garden',
      tags: ['philosophy', 'ai'],
      outgoingLinks: ['phenomenology', 'free-will'],
    };

    it('should generate Article schema with description, dates and language', () => {
      const result = generateGardenNoteJsonLd({
        note: mockNote,
        locale: 'en',
        description: 'A note about how minds relate to machines.',
      });

      expect(result['@context']).toBe('https://schema.org');
      expect(result['@type']).toBe('Article');
      expect(result.headline).toBe('Mind and Machines');
      expect(result.description).toBe('A note about how minds relate to machines.');
      expect(result.datePublished).toBe('2025-03-01');
      expect(result.dateModified).toBe('2025-03-01');
      expect(result.url).toContain('/en/garden/mind-and-machines');
      expect(result.inLanguage).toBe('en-US');
      expect(result.articleSection).toBe('Digital Garden');
      expect(result.keywords).toBe('philosophy, ai');
    });

    it('should use updated as dateModified when provided', () => {
      const result = generateGardenNoteJsonLd({
        note: { ...mockNote, updated: '2025-09-10' },
        locale: 'en',
        description: 'desc',
      });

      expect(result.dateModified).toBe('2025-09-10');
    });

    it('should map outgoingNotes to mentions and backlinks to citation', () => {
      const result = generateGardenNoteJsonLd({
        note: mockNote,
        locale: 'ko',
        description: 'desc',
        outgoingNotes: [{ slug: 'phenomenology', title: '현상학' }],
        backlinks: [{ slug: 'meta-cognition', title: '메타인지' }],
      });

      expect(result.mentions).toEqual([
        expect.objectContaining({
          '@type': 'Article',
          url: expect.stringContaining('/ko/garden/phenomenology'),
          name: '현상학',
        }),
      ]);
      expect(result.citation).toEqual([
        expect.objectContaining({
          '@type': 'Article',
          url: expect.stringContaining('/ko/garden/meta-cognition'),
          name: '메타인지',
        }),
      ]);
    });

    it('should omit mentions and citation when empty', () => {
      const result = generateGardenNoteJsonLd({
        note: mockNote,
        locale: 'ko',
        description: 'desc',
      });

      expect(result.mentions).toBeUndefined();
      expect(result.citation).toBeUndefined();
    });

    it('should declare isPartOf the Digital Garden series', () => {
      const result = generateGardenNoteJsonLd({
        note: mockNote,
        locale: 'en',
        description: 'desc',
      });

      expect(result.isPartOf).toEqual({
        '@type': 'CreativeWorkSeries',
        name: 'Digital Garden',
        url: expect.stringContaining('/en/garden'),
      });
    });
  });
});
