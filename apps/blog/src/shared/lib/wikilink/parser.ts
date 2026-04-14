/**
 * Wikilink 파싱 유틸리티
 * Obsidian 호환 문법:
 * - [[slug]], [[slug|label]]
 * - [[slug#heading]], [[slug^block]]
 * - [[#heading]], [[^block]]
 * - ![[...]] (embed)
 */

export interface WikiLinkTarget {
  slug: string;
  heading?: string;
  blockId?: string;
  isInternal: boolean;
  target: string;
}

export interface WikiLink extends WikiLinkTarget {
  label: string;
  raw: string;
  isEmbed: boolean;
}

export interface ParsedContent {
  content: string;
  wikilinks: WikiLink[];
}

const WIKILINK_REGEX = /(!)?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export function parseWikilinkTarget(rawTarget: string): WikiLinkTarget {
  const target = rawTarget.trim();

  if (target.startsWith('#')) {
    return {
      slug: '',
      heading: target.slice(1).trim(),
      blockId: undefined,
      isInternal: true,
      target,
    };
  }

  if (target.startsWith('^')) {
    return {
      slug: '',
      heading: undefined,
      blockId: target.slice(1).trim(),
      isInternal: true,
      target,
    };
  }

  if (target.includes('#')) {
    const [slugPart, ...rest] = target.split('#');
    const anchorPart = rest.join('#').trim();

    if (anchorPart.startsWith('^')) {
      return {
        slug: slugPart?.trim() ?? '',
        heading: undefined,
        blockId: anchorPart.slice(1).trim(),
        isInternal: false,
        target,
      };
    }

    return {
      slug: slugPart?.trim() ?? '',
      heading: anchorPart,
      blockId: undefined,
      isInternal: false,
      target,
    };
  }

  if (target.includes('^')) {
    const [slugPart, ...rest] = target.split('^');
    return {
      slug: slugPart?.trim() ?? '',
      heading: undefined,
      blockId: rest.join('^').trim(),
      isInternal: false,
      target,
    };
  }

  return {
    slug: target,
    heading: undefined,
    blockId: undefined,
    isInternal: false,
    target,
  };
}

export function parseWikilinks(content: string): WikiLink[] {
  WIKILINK_REGEX.lastIndex = 0;
  const wikilinks: WikiLink[] = [];
  let match: RegExpExecArray | null;

  while ((match = WIKILINK_REGEX.exec(content)) !== null) {
    const [raw, embedMarker, rawTarget, label] = match;
    const parsedTarget = parseWikilinkTarget(rawTarget ?? '');
    const fallbackLabel = parsedTarget.target;

    wikilinks.push({
      ...parsedTarget,
      label: label?.trim() || fallbackLabel,
      raw,
      isEmbed: Boolean(embedMarker),
    });
  }

  return wikilinks;
}

export function extractWikilinkSlugs(content: string): string[] {
  const wikilinks = parseWikilinks(content);
  return [...new Set(wikilinks.map(link => link.slug).filter(Boolean))];
}

export function hasWikilinks(content: string): boolean {
  WIKILINK_REGEX.lastIndex = 0;
  return WIKILINK_REGEX.test(content);
}
