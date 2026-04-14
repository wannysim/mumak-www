const NON_WORD_SEPARATOR_REGEX = /[^\p{Letter}\p{Number}\s-]/gu;
const MULTI_SPACE_REGEX = /\s+/g;
const MULTI_DASH_REGEX = /-+/g;

export function normalizeHeadingToAnchor(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(NON_WORD_SEPARATOR_REGEX, '')
    .replace(MULTI_SPACE_REGEX, '-')
    .replace(MULTI_DASH_REGEX, '-');
}

export function buildAnchorSuffix(params: { heading?: string; blockId?: string }): string {
  const { heading, blockId } = params;

  if (heading) {
    return `#${normalizeHeadingToAnchor(heading)}`;
  }

  if (blockId) {
    return `#^${blockId}`;
  }

  return '';
}
