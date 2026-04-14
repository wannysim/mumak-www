import { buildAnchorSuffix } from './anchor';
import { parseWikilinkTarget } from './parser';

/**
 * Wikilink를 MDX에서 렌더링 가능한 형태로 변환
 */

export interface LinkResolverInput {
  slug: string;
  heading?: string;
  blockId?: string;
}

export interface EmbedPreview {
  title: string;
  excerpt: string;
}

export interface LinkResolver {
  resolve(input: LinkResolverInput): string | null;
  exists(input: LinkResolverInput): boolean;
  getEmbedPreview(input: LinkResolverInput): EmbedPreview | null;
}

export interface TransformOptions {
  resolver: LinkResolver;
  currentSlug: string;
}

const WIKILINK_REGEX = /(!)?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

function escapeForAttribute(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeForContent(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function transformWikilinks(content: string, options: TransformOptions): string {
  const { resolver, currentSlug } = options;

  return content.replace(WIKILINK_REGEX, (raw, embedMarker, rawTarget: string, label?: string) => {
    const target = parseWikilinkTarget(rawTarget ?? '');
    const resolvedSlug = target.slug || currentSlug;
    const input: LinkResolverInput = {
      slug: resolvedSlug,
      heading: target.heading,
      blockId: target.blockId,
    };

    const href = resolver.resolve(input);
    const exists = resolver.exists(input);
    const displayLabel = label?.trim() || target.target;
    const safeSlug = escapeForAttribute(target.target);
    const safeLabel = escapeForContent(displayLabel);

    if (embedMarker) {
      const preview = resolver.getEmbedPreview(input);

      if (!href || !exists || !preview) {
        return `<BrokenWikiEmbed slug="${safeSlug}" />`;
      }

      const safeHref = escapeForAttribute(href);
      const safeTitle = escapeForAttribute(preview.title);
      const safeExcerpt = escapeForAttribute(preview.excerpt);
      return `<WikiEmbed href="${safeHref}" slug="${safeSlug}" title="${safeTitle}" excerpt="${safeExcerpt}" />`;
    }

    if (!href || !exists) {
      return `<BrokenWikiLink slug="${safeSlug}">${safeLabel}</BrokenWikiLink>`;
    }

    const safeHref = escapeForAttribute(href);
    return `<WikiLink href="${safeHref}" slug="${safeSlug}">${safeLabel}</WikiLink>`;
  });
}

export interface GardenResolverOptions {
  existingSlugs: Set<string>;
  hasHeadingAnchor: (slug: string, heading: string) => boolean;
  hasBlockAnchor: (slug: string, blockId: string) => boolean;
  getEmbedPreview: (input: LinkResolverInput) => EmbedPreview | null;
}

export function createGardenResolver(options: GardenResolverOptions): LinkResolver {
  const { existingSlugs, hasHeadingAnchor, hasBlockAnchor, getEmbedPreview } = options;

  return {
    resolve(input: LinkResolverInput): string | null {
      const { slug, heading, blockId } = input;
      if (!slug) {
        return null;
      }

      // next-intl Link가 자동으로 locale prefix를 추가하므로 locale 제외
      return `/garden/${slug}${buildAnchorSuffix({ heading, blockId })}`;
    },
    exists(input: LinkResolverInput): boolean {
      const { slug, heading, blockId } = input;
      if (!existingSlugs.has(slug)) {
        return false;
      }

      if (heading) {
        return hasHeadingAnchor(slug, heading);
      }

      if (blockId) {
        return hasBlockAnchor(slug, blockId);
      }

      return true;
    },
    getEmbedPreview(input: LinkResolverInput): EmbedPreview | null {
      if (!this.exists(input)) {
        return null;
      }

      return getEmbedPreview(input);
    },
  };
}
