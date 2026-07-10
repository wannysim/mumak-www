'use client';

import { ChevronRight } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@mumak/ui/components/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mumak/ui/components/collapsible';
import { cn } from '@mumak/ui/lib/utils';

import { Link } from '@/src/shared/config/i18n';

import type { Category, SidebarTreeNode } from '../model/note-tree';

function hasActiveDescendant(node: SidebarTreeNode, pathname: string): boolean {
  return node.children.some(child => pathname === `/garden/${child.slug}` || hasActiveDescendant(child, pathname));
}

function NoteTreeItem({
  node,
  pathname,
  depth,
  onNavigate,
}: {
  node: SidebarTreeNode;
  pathname: string;
  depth: number;
  onNavigate?: () => void;
}) {
  const isActive = pathname === `/garden/${node.slug}`;
  const hasChildren = node.children.length > 0;
  const isAncestorOfActive = hasChildren && hasActiveDescendant(node, pathname);
  const [open, setOpen] = React.useState(isAncestorOfActive);

  // 활성 노트가 하위로 들어오면 펼친다. effect 대신 render 중 prev 비교로
  // 조정해 닫힌 채로 한 프레임 그려지는 일이 없다. 사용자가 수동으로 닫는
  // 것은 그대로 유지된다 (전환 시점에만 강제로 연다).
  const [prevAncestorOfActive, setPrevAncestorOfActive] = React.useState(isAncestorOfActive);
  if (isAncestorOfActive !== prevAncestorOfActive) {
    setPrevAncestorOfActive(isAncestorOfActive);
    if (isAncestorOfActive) setOpen(true);
  }

  const link = (
    <Link
      href={`/garden/${node.slug}`}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors min-w-0',
        'text-sidebar-foreground/85',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        isActive && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
      )}
    >
      <span className="truncate">{node.title}</span>
    </Link>
  );

  const row = (
    <div className="flex items-center gap-0.5" style={{ paddingLeft: `${depth * 12}px` }}>
      {hasChildren ? (
        <CollapsibleTrigger asChild>
          <button
            type="button"
            aria-label={open ? 'Collapse' : 'Expand'}
            className={cn(
              'inline-flex size-5 shrink-0 items-center justify-center rounded transition-colors',
              'text-sidebar-foreground/60',
              'hover:bg-sidebar-border/60 hover:text-sidebar-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring'
            )}
          >
            <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
          </button>
        </CollapsibleTrigger>
      ) : (
        <span className="size-5 shrink-0" aria-hidden />
      )}
      {link}
    </div>
  );

  if (!hasChildren) {
    return <li>{row}</li>;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <li>
        {row}
        <CollapsibleContent>
          <ul className="flex flex-col">
            {node.children.map(child => (
              <NoteTreeItem
                key={child.slug}
                node={child}
                pathname={pathname}
                depth={depth + 1}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </CollapsibleContent>
      </li>
    </Collapsible>
  );
}

export function TreeContent({
  visibleCategories,
  pathname,
  onNavigate,
}: {
  visibleCategories: Category[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Garden notes" className="flex flex-col gap-4">
      {visibleCategories.map(category => (
        <section key={category.key} className="flex flex-col gap-1">
          <header className="flex items-center justify-between gap-2 px-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
              {category.label}
            </span>
            <Badge variant="secondary" className="h-5 rounded-sm px-1.5 py-0 font-normal">
              {category.noteCount}
            </Badge>
          </header>
          <ul className="flex flex-col">
            {category.tree.map(node => (
              <NoteTreeItem key={node.slug} node={node} pathname={pathname} depth={0} onNavigate={onNavigate} />
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
