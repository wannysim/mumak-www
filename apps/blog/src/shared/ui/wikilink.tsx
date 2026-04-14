import { type ComponentProps } from 'react';

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
      className={cn(
        'text-primary underline decoration-dotted underline-offset-4',
        'hover:decoration-solid hover:text-primary/80',
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

interface BrokenWikiLinkProps extends ComponentProps<'span'> {
  slug: string;
}

export function BrokenWikiLink({ slug, className, children, ...props }: BrokenWikiLinkProps) {
  return (
    <span
      className={cn('text-muted-foreground line-through cursor-not-allowed', className)}
      data-wikilink-broken
      data-slug={slug}
      title={`"${slug}" 노트가 존재하지 않습니다`}
      {...props}
    >
      {children}
    </span>
  );
}

function WikiEmbedContainer({ className, children, ...props }: ComponentProps<'aside'>) {
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
        className="mb-2 inline-block font-medium text-primary underline decoration-dotted underline-offset-4 hover:decoration-solid hover:text-primary/80"
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
  className,
  ...props
}: ComponentProps<'aside'> & {
  slug: string;
}) {
  return (
    <WikiEmbedContainer
      className={cn('border-dashed text-muted-foreground', className)}
      data-wiki-embed-broken
      data-slug={slug}
      title={`"${slug}" 임베드 대상을 찾을 수 없습니다`}
      {...props}
    >
      <p className="m-0 line-through">임베드 실패: {slug}</p>
    </WikiEmbedContainer>
  );
}
