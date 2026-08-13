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

export interface BrokenNotice {
  // 깨진 인라인 링크용 안내. slug는 이미 링크 텍스트로 남아 있으므로 문구에 넣지 않는다
  // (넣으면 스크린리더가 같은 slug를 두 번 읽는다).
  link: string;
  embed: (slug: string) => string;
}

export interface TransformOptions {
  resolver: LinkResolver;
  currentSlug: string;
  // 필수로 둔다. optional이면 번역 안 된 문구가 조용히 배포되는 경로가 생긴다.
  brokenNotice: BrokenNotice;
}

const WIKILINK_REGEX = /(!)?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

function escapeForAttribute(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeForContent(str: string): string {
  return (
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // 라벨은 이제 노트 frontmatter title에서도 오므로 MDX 텍스트에 중괄호가 실릴 수 있다.
      // 이스케이프하지 않으면 MDX가 expression으로 파싱해 빌드가 깨진다.
      .replace(/\{/g, '&#123;')
      .replace(/\}/g, '&#125;')
  );
}

// 같은 노트의 서로 다른 섹션을 가리키는 링크가 전부 같은 텍스트가 되면 링크 목적을
// 구분할 수 없다(WCAG 2.4.4). 헤딩 앵커는 사람이 읽을 문구이므로 제목 뒤에 덧붙인다.
// 블록 앵커(`^abc123`)는 읽을 문구가 아니라서 붙이지 않는다.
function withHeading(title: string | undefined, heading: string | undefined): string | undefined {
  if (!title) return undefined;
  return heading ? `${title} § ${heading}` : title;
}

export function transformWikilinks(content: string, options: TransformOptions): string {
  const { resolver, currentSlug, brokenNotice } = options;

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
    // alias가 없으면 대상 노트의 제목을 링크 텍스트로 쓴다. kebab-case slug가 문장 한가운데
    // 그대로 노출되는 것을 막는다. 세 가지 예외:
    // - 깨진 링크(!exists)는 slug를 유지한다. 저자가 오타를 눈으로 찾아야 한다.
    // - `[[#heading]]`처럼 target.slug가 없는 문서 내부 링크는 자기 제목으로 바뀌면 뜻이 어긋난다.
    // - 임베드는 제목을 이미 별도 attribute로 싣는다.
    const noteTitle =
      !embedMarker && !label?.trim() && exists && target.slug
        ? withHeading(resolver.getEmbedPreview(input)?.title, target.heading)
        : undefined;
    const displayLabel = label?.trim() || noteTitle || target.target;
    const safeSlug = escapeForAttribute(target.target);
    const safeLabel = escapeForContent(displayLabel);

    if (embedMarker) {
      const preview = resolver.getEmbedPreview(input);

      if (!href || !exists || !preview) {
        const safeNotice = escapeForAttribute(brokenNotice.embed(target.target));
        return `<BrokenWikiEmbed slug="${safeSlug}" notice="${safeNotice}" />`;
      }

      const safeHref = escapeForAttribute(href);
      const safeTitle = escapeForAttribute(preview.title);
      const safeExcerpt = escapeForAttribute(preview.excerpt);
      return `<WikiEmbed href="${safeHref}" slug="${safeSlug}" title="${safeTitle}" excerpt="${safeExcerpt}" />`;
    }

    if (!href || !exists) {
      const safeNotice = escapeForAttribute(brokenNotice.link);
      return `<BrokenWikiLink slug="${safeSlug}" notice="${safeNotice}">${safeLabel}</BrokenWikiLink>`;
    }

    const safeHref = escapeForAttribute(href);
    return `<WikiLink href="${safeHref}" slug="${safeSlug}">${safeLabel}</WikiLink>`;
  });
}

export interface MarkdownTransformOptions {
  // wikilink target을 일반 마크다운 링크의 href로 변환한다.
  hrefFor: (input: LinkResolverInput) => string;
  // alias 없는 링크의 표시 텍스트. transformWikilinks와 동일한 우선순위(alias > 제목 > slug)를
  // 쓰기 위한 주입점. 제목을 못 찾으면 slug로 떨어진다.
  titleFor?: (input: LinkResolverInput) => string | null | undefined;
}

// wikilink를 일반 마크다운 링크(`[label](href)`)로 치환한다. 마크다운 원문/피드처럼
// JSX(WikiLink) 컴포넌트를 렌더할 수 없는 소비 경로용. 파서(parseWikilinkTarget)와
// 정규식을 transformWikilinks와 공유해 문법 해석을 단일 소스로 유지한다.
export function transformWikilinksToMarkdown(content: string, options: MarkdownTransformOptions): string {
  const { hrefFor, titleFor } = options;

  return content.replace(WIKILINK_REGEX, (_raw, _embedMarker, rawTarget: string, label?: string) => {
    const target = parseWikilinkTarget(rawTarget ?? '');
    const href = hrefFor({ slug: target.slug, heading: target.heading, blockId: target.blockId });
    // transformWikilinks와 같은 규칙: alias > 대상 노트 제목(+헤딩 앵커) > 원문 target.
    const noteTitle =
      !label?.trim() && target.slug
        ? withHeading(
            titleFor?.({ slug: target.slug, heading: target.heading, blockId: target.blockId }) ?? undefined,
            target.heading
          )
        : undefined;
    const displayLabel = (label?.trim() || noteTitle || target.target).replace(/]/g, '\\]');

    return `[${displayLabel}](${href})`;
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
