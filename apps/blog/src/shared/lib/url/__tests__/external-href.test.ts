import { EXTERNAL_LINK_REL, isExternalHref, isInAppHref } from '../external-href';

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

it('exposes a safe rel constant for new-tab links', () => {
  expect(EXTERNAL_LINK_REL).toContain('noopener');
});
