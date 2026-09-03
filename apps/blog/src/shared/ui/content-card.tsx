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

// 카드 전체를 하나의 <Link>로 감싸면 카드 안의 태그(#tag)도 anchor로 만들 때
// anchor-in-anchor(중첩 interactive)가 되어 axe nested-interactive를 위반한다.
// 그래서 제목만 실제 링크로 두고 `after:absolute inset-0`로 표면 전체를 덮어
// "카드 어디나 클릭 가능"을 유지한다. 태그 등 보조 링크는 z-10으로 오버레이
// 위에 올려 독립적으로 포커스·클릭되게 한다. (stretched-link 패턴)
export function ContentCard({ href, title, meta, description, tags, footer }: ContentCardProps) {
  return (
    <article
      data-slot="content-card"
      className={cn(
        cardSurfaceClass,
        'group relative p-5',
        'has-[[data-slot=content-card-link]:focus-visible]:ring-2 has-[[data-slot=content-card-link]:focus-visible]:ring-ring'
      )}
    >
      <div className="mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">{meta}</div>
      <h3 className="text-xl font-semibold tracking-tight">
        <Link
          href={href}
          data-slot="content-card-link"
          className="text-foreground transition-colors after:absolute after:inset-0 after:rounded-lg group-hover:text-accent-foreground focus-visible:outline-none"
        >
          {title}
        </Link>
      </h3>
      {description && <p className="mt-1.5 leading-relaxed text-muted-foreground line-clamp-2">{description}</p>}
      {tags && <div className="relative z-10 mt-3">{tags}</div>}
      {footer && <div className="mt-3">{footer}</div>}
    </article>
  );
}
