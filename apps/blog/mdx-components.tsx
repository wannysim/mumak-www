import type { MDXComponents } from 'mdx/types';
import Image from 'next/image';
import Link from 'next/link';
import { isValidElement, type ReactNode } from 'react';

import { normalizeHeadingToAnchor } from '@/src/shared/lib/wikilink';
import { BrokenWikiEmbed, BrokenWikiLink, WikiEmbed, WikiLink } from '@/src/shared/ui';
import { SocialLinks } from '@/src/widgets/footer';

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
  a: ({ href, children }) => (
    <Link href={href || '#'} className="text-primary underline underline-offset-4 hover:text-primary/80">
      {children}
    </Link>
  ),
  ul: ({ children }) => <ul className="my-4 ml-6 list-disc space-y-2">{children}</ul>,
  ol: ({ children }) => <ol className="my-4 ml-6 list-decimal space-y-2">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-4 border-muted pl-4 italic text-muted-foreground">{children}</blockquote>
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
