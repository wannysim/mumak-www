import type { PostMeta } from '@/src/entities/post';

import {
  generateBlogPostingJsonLd,
  generateBreadcrumbJsonLd,
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
    });

    it('should generate correct URL for English locale', () => {
      const result = generateBlogPostingJsonLd({
        post: mockPost,
        locale: 'en',
        category: 'essay',
      });

      expect(result.url).toContain('/en/blog/essay/test-post');
      expect(result.inLanguage).toBe('en-US');
    });

    it('should include author and publisher info', () => {
      const result = generateBlogPostingJsonLd({
        post: mockPost,
        locale: 'ko',
        category: 'articles',
      });

      expect(result.author).toEqual({
        '@type': 'Person',
        name: 'Wan Sim',
        url: expect.any(String),
      });
      expect(result.publisher).toEqual({
        '@type': 'Person',
        name: 'Wan Sim',
        url: expect.any(String),
      });
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
});
