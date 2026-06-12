/**
 * Single source of truth for "how should this href be rendered?".
 *
 * - external: absolute http(s) or protocol-relative URL → open in a new tab
 *   with {@link EXTERNAL_LINK_REL}.
 * - in-app: site-internal path (`/...`) or hash (`#...`) → use the locale-aware
 *   next-intl `Link` so the locale prefix is preserved.
 * - everything else (mailto:, tel:, relative paths) falls through to a plain
 *   anchor without new-tab behaviour.
 */

import { isValidLocale } from '@/src/shared/config/i18n/config';

export const EXTERNAL_LINK_REL = 'noopener noreferrer';

const EXTERNAL_HREF_RE = /^(?:https?:)?\/\//i;
const BLOG_CONTENT_SECTIONS = new Set(['articles', 'essay', 'notes']);

export function isExternalHref(href: string | null | undefined): href is string {
  return typeof href === 'string' && EXTERNAL_HREF_RE.test(href);
}

export function isInAppHref(href: string | null | undefined): href is string {
  return typeof href === 'string' && (href.startsWith('/') || href.startsWith('#'));
}

function splitHrefSuffix(href: string): { path: string; suffix: string } {
  const match = href.match(/^([^?#]*)([?#].*)?$/);
  return {
    path: match?.[1] ?? href,
    suffix: match?.[2] ?? '',
  };
}

function stripMdxExtension(path: string): string {
  return path.endsWith('.mdx') ? path.slice(0, -'.mdx'.length) : path;
}

export function stripLocalePrefixFromInAppHref(href: string): string {
  if (!href.startsWith('/')) {
    return href;
  }

  const match = href.match(/^\/([^/?#]+)(.*)$/);
  if (!match) {
    return href;
  }

  const [, maybeLocale, rest = ''] = match;
  if (!maybeLocale || !isValidLocale(maybeLocale)) {
    return href;
  }

  if (rest === '') {
    return '/';
  }

  return rest.startsWith('/') ? rest : `/${rest}`;
}

export function normalizeMdxInAppHref(href: string): string {
  const { path, suffix } = splitHrefSuffix(href);

  if (!path.startsWith('/')) {
    return `${stripMdxExtension(path)}${suffix}`;
  }

  const segments = path.split('/').filter(Boolean);
  const [maybeLocale, section, ...rest] = segments;

  if (maybeLocale && isValidLocale(maybeLocale) && section && rest.length > 0) {
    const lastSegment = rest.at(-1);
    const slug = lastSegment ? stripMdxExtension(lastSegment) : '';

    if (BLOG_CONTENT_SECTIONS.has(section) && rest.length === 1) {
      return `/blog/${section}/${slug}${suffix}`;
    }

    if (section === 'garden' && slug) {
      return `/garden/${slug}${suffix}`;
    }
  }

  return stripLocalePrefixFromInAppHref(`${stripMdxExtension(path)}${suffix}`);
}
