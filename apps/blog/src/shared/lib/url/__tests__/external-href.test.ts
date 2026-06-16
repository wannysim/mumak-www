import {
  EXTERNAL_LINK_REL,
  isExternalHref,
  isInAppHref,
  normalizeMdxInAppHref,
  stripLocalePrefixFromInAppHref,
} from '../external-href';

describe('isExternalHref', () => {
  it.each(['https://example.com', 'http://example.com/x', '//cdn.example.com/a.js', 'HTTPS://EXAMPLE.COM'])(
    'treats %s as external',
    href => {
      expect(isExternalHref(href)).toBe(true);
    }
  );

  it.each(['/about', '#top', 'mailto:a@b.com', 'tel:123', './relative', '', null, undefined])(
    'treats %s as not external',
    href => {
      expect(isExternalHref(href)).toBe(false);
    }
  );
});

describe('isInAppHref', () => {
  it.each(['/about', '/ko/blog/foo', '#section'])('treats %s as in-app', href => {
    expect(isInAppHref(href)).toBe(true);
  });

  it.each(['https://example.com', 'mailto:a@b.com', 'relative', null, undefined])('treats %s as not in-app', href => {
    expect(isInAppHref(href)).toBe(false);
  });
});

describe('stripLocalePrefixFromInAppHref', () => {
  it.each([
    ['/ko/blog/articles/react-compiler-rust-port', '/blog/articles/react-compiler-rust-port'],
    ['/en/blog/foo', '/blog/foo'],
    ['/ko', '/'],
    ['/ko?draft=1', '/?draft=1'],
    ['/ko#top', '/#top'],
    ['/koala/blog/foo', '/koala/blog/foo'],
    ['/blog/foo', '/blog/foo'],
    ['#section', '#section'],
  ])('normalizes %s to %s', (href, expected) => {
    expect(stripLocalePrefixFromInAppHref(href)).toBe(expected);
  });
});

describe('normalizeMdxInAppHref', () => {
  it.each([
    ['/ko/blog/articles/react-compiler-rust-port', '/blog/articles/react-compiler-rust-port'],
    ['/ko/articles/react-compiler-rust-port.mdx', '/blog/articles/react-compiler-rust-port'],
    ['/en/essay/ai-survival.mdx#section', '/blog/essay/ai-survival#section'],
    ['/ko/garden/resources/frontend/browser/browser-rendering-pipeline.mdx', '/garden/browser-rendering-pipeline'],
    ['/ko/garden/archives/reading-archive/2026-06-09.mdx?preview=1', '/garden/2026-06-09?preview=1'],
    ['/blog/articles/react-compiler-rust-port.mdx', '/blog/articles/react-compiler-rust-port'],
    ['#section', '#section'],
  ])('normalizes %s to %s', (href, expected) => {
    expect(normalizeMdxInAppHref(href)).toBe(expected);
  });
});

it('exposes a safe rel constant for new-tab links', () => {
  expect(EXTERNAL_LINK_REL).toContain('noopener');
});
