import * as React from 'react';

import { cn } from '@mumak/ui/lib/utils';

import { Link } from '@/src/shared/config/i18n';

import { cardSurfaceClass } from './card-surface';

interface ContentCardProps {
  href: string;
  title: React.ReactNode;
  meta: React.ReactNode;
  description?: React.ReactNode;
  tags?: React.ReactNode;
  footer?: React.ReactNode;
}

export function ContentCard({ href, title, meta, description, tags, footer }: ContentCardProps) {
  return (
    <Link href={href} className="group block">
      <article data-slot="content-card" className={cn(cardSurfaceClass, 'p-5')}>
        <div className="mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">{meta}</div>
        <h3 className="text-xl font-semibold tracking-tight transition-colors group-hover:text-primary">{title}</h3>
        {description && <p className="mt-1.5 leading-relaxed text-muted-foreground line-clamp-2">{description}</p>}
        {tags && <div className="mt-3">{tags}</div>}
        {footer && <div className="mt-3">{footer}</div>}
      </article>
    </Link>
  );
}
