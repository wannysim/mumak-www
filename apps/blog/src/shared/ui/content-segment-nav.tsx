'use client';

import * as React from 'react';

import { cn } from '@mumak/ui/lib/utils';

import { Link } from '@/src/shared/config/i18n';

interface ContentSegmentNavItem {
  key: string;
  href: string;
  label: React.ReactNode;
  active: boolean;
  icon?: React.ReactNode;
  count?: number;
  dividerBefore?: boolean;
}

interface ContentSegmentNavProps {
  items: ContentSegmentNavItem[];
  'aria-label'?: string;
}

const baseItemClass =
  'inline-flex min-h-7 max-w-full min-w-0 items-center justify-center overflow-hidden rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] sm:h-[calc(100%-1px)]';
const activeClass = 'bg-background text-foreground shadow-sm dark:bg-input/30 dark:border-input';
const inactiveClass = 'text-foreground dark:text-muted-foreground hover:text-foreground';

export function ContentSegmentNav({ items, 'aria-label': ariaLabel }: ContentSegmentNavProps) {
  return (
    <nav
      data-slot="content-segment-nav"
      aria-label={ariaLabel}
      className="bg-muted text-muted-foreground flex w-full max-w-full flex-wrap items-center justify-start gap-1 rounded-lg p-[3px] sm:inline-flex sm:h-9 sm:w-fit sm:flex-nowrap sm:justify-center sm:gap-0"
    >
      {items.map(item => (
        <React.Fragment key={item.key}>
          {item.dividerBefore && <div className="bg-border mx-1 hidden h-4 w-px shrink-0 sm:block" />}
          <Link
            href={item.href}
            aria-current={item.active ? 'page' : undefined}
            className={cn(baseItemClass, item.icon && 'gap-1', item.active ? activeClass : inactiveClass)}
          >
            {item.icon && <span className="shrink-0">{item.icon}</span>}
            {item.label && <span className="min-w-0 truncate">{item.label}</span>}
            {typeof item.count === 'number' && (
              <span data-slot="content-segment-nav-count" className="ml-1 shrink-0 text-xs tabular-nums opacity-60">
                {item.count}
              </span>
            )}
          </Link>
        </React.Fragment>
      ))}
    </nav>
  );
}

export { type ContentSegmentNavItem };
