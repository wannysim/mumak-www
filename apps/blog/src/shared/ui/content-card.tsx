import * as React from 'react';

import { Link } from '@/src/shared/config/i18n';

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
    <Link href={href} className="block">
      <article
        data-slot="content-card"
        className="border border-border rounded-lg p-4 hover:bg-muted/50 active:scale-[0.98] transition-all duration-150"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">{meta}</div>
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        {description && <p className="text-muted-foreground mb-3">{description}</p>}
        {tags && <div className="mb-3">{tags}</div>}
        {footer}
      </article>
    </Link>
  );
}
