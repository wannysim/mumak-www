import { buildAlternates } from '../alternates';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wannysim.com';

describe('buildAlternates', () => {
  it('should set canonical to current locale + path', () => {
    const result = buildAlternates({ locale: 'ko', path: '/blog/articles/foo' });

    expect(result.canonical).toBe(`${BASE_URL}/ko/blog/articles/foo`);
  });

  it('should map every supported locale to languages', () => {
    const result = buildAlternates({ locale: 'ko', path: '/about' });

    expect(result.languages.ko).toBe(`${BASE_URL}/ko/about`);
    expect(result.languages.en).toBe(`${BASE_URL}/en/about`);
  });

  it('should set x-default to the default locale URL', () => {
    const result = buildAlternates({ locale: 'en', path: '/about' });

    expect(result.languages['x-default']).toBe(`${BASE_URL}/ko/about`);
  });

  it('should treat empty path as the locale root', () => {
    const result = buildAlternates({ locale: 'en', path: '' });

    expect(result.canonical).toBe(`${BASE_URL}/en`);
    expect(result.languages.en).toBe(`${BASE_URL}/en`);
    expect(result.languages.ko).toBe(`${BASE_URL}/ko`);
    expect(result.languages['x-default']).toBe(`${BASE_URL}/ko`);
  });

  it('should treat "/" path same as empty', () => {
    const result = buildAlternates({ locale: 'en', path: '/' });

    expect(result.canonical).toBe(`${BASE_URL}/en`);
  });

  it('should normalize a path missing the leading slash', () => {
    const result = buildAlternates({ locale: 'ko', path: 'blog' });

    expect(result.canonical).toBe(`${BASE_URL}/ko/blog`);
    expect(result.languages.ko).toBe(`${BASE_URL}/ko/blog`);
  });

  it('should restrict languages to availableLocales when provided', () => {
    const result = buildAlternates({ locale: 'ko', path: '/garden/foo', availableLocales: ['ko'] });

    expect(result.languages.ko).toBe(`${BASE_URL}/ko/garden/foo`);
    expect(result.languages.en).toBeUndefined();
  });

  it('should omit x-default when default locale is excluded from availableLocales', () => {
    const result = buildAlternates({ locale: 'en', path: '/garden/foo', availableLocales: ['en'] });

    expect(result.languages['x-default']).toBeUndefined();
  });

  it('should preserve x-default when default locale is included in availableLocales', () => {
    const result = buildAlternates({ locale: 'en', path: '/garden/foo', availableLocales: ['en', 'ko'] });

    expect(result.languages['x-default']).toBe(`${BASE_URL}/ko/garden/foo`);
  });

  describe('RSS autodiscovery types', () => {
    it('should advertise the current locale RSS feed', () => {
      const result = buildAlternates({ locale: 'ko', path: '/blog' });

      expect(result.types['application/rss+xml']).toBe(`${BASE_URL}/ko/feed.xml`);
    });

    it('should point to the locale-specific feed regardless of path', () => {
      const result = buildAlternates({ locale: 'en', path: '/garden/foo' });

      expect(result.types['application/rss+xml']).toBe(`${BASE_URL}/en/feed.xml`);
    });
  });
});
