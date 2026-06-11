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

export const EXTERNAL_LINK_REL = 'noopener noreferrer';

const EXTERNAL_HREF_RE = /^(?:https?:)?\/\//i;

export function isExternalHref(href: string | null | undefined): href is string {
  return typeof href === 'string' && EXTERNAL_HREF_RE.test(href);
}

export function isInAppHref(href: string | null | undefined): href is string {
  return typeof href === 'string' && (href.startsWith('/') || href.startsWith('#'));
}
