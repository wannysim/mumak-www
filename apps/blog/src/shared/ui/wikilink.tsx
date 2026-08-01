import { type ComponentProps, type ComponentPropsWithoutRef } from 'react';

import { cn } from '@mumak/ui/lib/utils';

import { Link } from '@/src/shared/config/i18n';

interface WikiLinkProps extends Omit<ComponentProps<typeof Link>, 'href'> {
  href: string;
  slug: string;
}

export function WikiLink({ href, slug, className, children, ...props }: WikiLinkProps) {
  return (
    <Link
      href={href}
      // 본문 MDX 링크(mdx-components.tsx)·연결된 노트와 같은 토큰. text-primary는 라이트에서
      // 3.48:1로 AA 미달이라 같은 hue의 accent-foreground(7.92:1 / 11.58:1)를 쓴다.
      // 위키링크만의 구분은 색이 아니라 점선 밑줄이 담당한다.
      className={cn(
        'text-accent-foreground underline decoration-dotted underline-offset-4',
        'hover:decoration-solid hover:text-accent-foreground/80',
        'transition-colors',
        className
      )}
      data-wikilink
      data-slug={slug}
      {...props}
    >
      {children}
    </Link>
  );
}

interface BrokenWikiLinkProps extends ComponentPropsWithoutRef<'span'> {
  slug: string;
  // 로케일 문구는 호출처(가든 상세 페이지)에서 해석해 내려준다. shared/ui는 next-intl에
  // 의존하지 않는다 — 이 디렉터리의 다른 primitive(Breadcrumbs, ContentSegmentNav 등)와 동일.
  notice: string;
}

export function BrokenWikiLink({ slug, notice, className, children, ...props }: BrokenWikiLinkProps) {
  return (
    <span
      // cursor-not-allowed는 비활성 컨트롤 신호라 inert한 span에는 맞지 않는다.
      className={cn('text-muted-foreground line-through', className)}
      data-wikilink-broken
      data-slug={slug}
      {...props}
    >
      {children}
      {/* 취소선·색만으로는 스크린리더와 터치 사용자에게 깨진 상태가 전달되지 않는다.
          role은 주지 않는다 — 링크가 아닌 것을 링크처럼 읽히게 만들면 안 된다.
          title 속성은 두지 않는다: 키보드·터치에서 읽히지 않으면서 NVDA 기본 설정에서는
          이 sr-only 문구와 겹쳐 같은 문장이 두 번 낭독된다. */}
      <span className="sr-only"> ({notice})</span>
    </span>
  );
}

function WikiEmbedContainer({ className, children, ...props }: ComponentPropsWithoutRef<'aside'>) {
  return (
    <aside
      className={cn('my-4 rounded-md border border-border bg-muted/30 p-4 text-sm', className)}
      data-wiki-embed
      {...props}
    >
      {children}
    </aside>
  );
}

export function WikiEmbed({
  href,
  slug,
  title,
  excerpt,
  className,
  ...props
}: Omit<ComponentProps<typeof Link>, 'href' | 'children'> & {
  href: string;
  slug: string;
  title: string;
  excerpt: string;
}) {
  return (
    <WikiEmbedContainer className={className}>
      <Link
        href={href}
        className="mb-2 inline-block font-medium text-accent-foreground underline decoration-dotted underline-offset-4 hover:decoration-solid hover:text-accent-foreground/80"
        data-wiki-embed-link
        data-slug={slug}
        {...props}
      >
        {title}
      </Link>
      <p className="m-0 text-muted-foreground">{excerpt}</p>
    </WikiEmbedContainer>
  );
}

export function BrokenWikiEmbed({
  slug,
  notice,
  className,
  ...props
}: ComponentPropsWithoutRef<'aside'> & {
  slug: string;
  notice: string;
}) {
  return (
    // 문구가 눈에 보이므로 title 속성은 중복이다. line-through도 뺀다 — 이 문장은
    // 삭제된 텍스트가 아니라 상태 설명이다.
    <WikiEmbedContainer
      className={cn('border-dashed text-muted-foreground', className)}
      data-wiki-embed-broken
      data-slug={slug}
      {...props}
    >
      <p className="m-0">{notice}</p>
    </WikiEmbedContainer>
  );
}
