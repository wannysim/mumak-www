'use client';

import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('garden.sidebar');
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

  // 컨트롤 목록으로 훑는 스크린리더 사용자에게 "펼치기"만 여러 개 들리지 않도록 노트 제목을
  // 이름에 넣는다. 사이드바 전체를 여닫는 garden.sidebar.collapse/expand와는 다른 동작이라 키도 다르다.
  const childNotesToggleLabel = t(open ? 'collapseChildNotes' : 'expandChildNotes', { title: node.title });

  const row = (
    <div className="flex items-center gap-0.5" style={{ paddingLeft: `${depth * 12}px` }}>
      {hasChildren ? (
        <CollapsibleTrigger asChild>
          <button
            type="button"
            aria-label={childNotesToggleLabel}
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
  const t = useTranslations('garden.sidebar');

  return (
    // 접근 가능한 이름이 로케일마다 달라지므로, 테스트는 data-slot을 앵커로 쓴다.
    <nav data-slot="garden-note-tree" aria-label={t('notesNav')} className="flex flex-col gap-4">
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
