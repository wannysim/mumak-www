import type { MDXComponents } from 'mdx/types';
import Image from 'next/image';
import { isValidElement, type ReactNode } from 'react';

import { Link } from '@/src/shared/config/i18n';
import { EXTERNAL_LINK_REL, isExternalHref, isInAppHref, normalizeMdxInAppHref } from '@/src/shared/lib/url';
import { normalizeHeadingToAnchor } from '@/src/shared/lib/wikilink';
import { BrokenWikiEmbed, BrokenWikiLink, WikiEmbed, WikiLink } from '@/src/shared/ui';
import { SocialLinks } from '@/src/widgets/footer';

// text-primary는 라이트에서 흰 배경 대비 3.48:1로 AA(4.5:1) 미달이다. 같은 hue 계열의
// accent-foreground가 7.92:1(라이트)/11.58:1(다크)이라 본문 링크는 이쪽을 쓴다.
// WikiLink/WikiEmbed/연결된 노트도 같은 토큰을 쓴다 — 한 페이지에서 링크 색이 갈리면 안 된다.
const MDX_LINK_CLASS = 'text-accent-foreground underline underline-offset-4 hover:text-accent-foreground/80';

function extractText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractText).join('');
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractText(node.props.children);
  }

  return '';
}

export const mdxComponents: MDXComponents = {
  // Override default elements with custom styling
  h1: ({ children }) => (
    <h1 id={normalizeHeadingToAnchor(extractText(children))} className="text-3xl font-bold mt-8 mb-4">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 id={normalizeHeadingToAnchor(extractText(children))} className="text-2xl font-semibold mt-6 mb-3">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 id={normalizeHeadingToAnchor(extractText(children))} className="text-xl font-semibold mt-4 mb-2">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 id={normalizeHeadingToAnchor(extractText(children))} className="text-lg font-semibold mt-4 mb-2">
      {children}
    </h4>
  ),
  h5: ({ children }) => (
    <h5 id={normalizeHeadingToAnchor(extractText(children))} className="text-base font-semibold mt-4 mb-2">
      {children}
    </h5>
  ),
  h6: ({ children }) => (
    <h6 id={normalizeHeadingToAnchor(extractText(children))} className="text-sm font-semibold mt-4 mb-2">
      {children}
    </h6>
  ),
  p: ({ children }) => <p className="my-4 leading-relaxed">{children}</p>,
  a: ({ href, children }) => {
    if (isExternalHref(href)) {
      return (
        <a href={href} target="_blank" rel={EXTERNAL_LINK_REL} className={MDX_LINK_CLASS}>
          {children}
        </a>
      );
    }

    if (isInAppHref(href)) {
      return (
        <Link href={normalizeMdxInAppHref(href)} className={MDX_LINK_CLASS}>
          {children}
        </Link>
      );
    }

    return (
      <a href={href ?? '#'} className={MDX_LINK_CLASS}>
        {children}
      </a>
    );
  },
  ul: ({ children }) => <ul className="my-4 ml-6 list-disc space-y-2">{children}</ul>,
  ol: ({ children }) => <ol className="my-4 ml-6 list-decimal space-y-2">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  // 이탤릭은 한글 장문에서 합성 oblique로 렌더돼 가독성을 해친다. 구분은 룰 + muted 박스가 담당한다.
  // text-muted-foreground는 bg-muted 위에서 4.35:1로 4.5:1을 못 넘겨 본문색을 foreground/90으로 올렸다.
  blockquote: ({ children }) => (
    <blockquote className="my-6 rounded-r-lg border-l-2 border-muted-foreground/40 bg-muted px-4 py-3 text-foreground/90 [&>p]:my-0 [&>p+p]:mt-3">
      {children}
    </blockquote>
  ),
  // 인라인 코드만 스타일 적용 (코드 블럭은 Prism이 처리)
  code: ({ children, className }) =>
    className ? (
      // Prism이 처리한 코드 블럭 내부 - 스타일 유지
      <code className={className}>{children}</code>
    ) : (
      // 인라인 코드
      <code className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono">{children}</code>
    ),
  // Prism 스타일 유지, 기본 레이아웃만 적용
  pre: ({ children, className, style }) => (
    <pre className={`my-4 p-4 rounded-lg overflow-x-auto ${className || ''}`} style={style}>
      {children}
    </pre>
  ),
  img: ({ src, alt }) => (
    <Image src={src || ''} alt={alt || ''} width={800} height={400} className="my-4 rounded-lg" loading="lazy" />
  ),
  hr: () => <hr className="my-8 border-border" />,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-border px-4 py-2 bg-muted font-semibold text-left">{children}</th>,
  td: ({ children }) => <td className="border border-border px-4 py-2">{children}</td>,
  // Custom components
  SocialLinks,
  // Garden wikilink components
  WikiLink,
  BrokenWikiLink,
  WikiEmbed,
  BrokenWikiEmbed,
};

// For @next/mdx compatibility (if needed in the future)
export function useMDXComponents(): MDXComponents {
  return mdxComponents;
}
