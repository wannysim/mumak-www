'use client';

import { ChevronRight, ChevronUp, FileText, FolderTree, PanelLeftClose, PanelLeftOpen, SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { Badge } from '@mumak/ui/components/badge';
import { Button } from '@mumak/ui/components/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mumak/ui/components/collapsible';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@mumak/ui/components/sheet';
import { cn } from '@mumak/ui/lib/utils';

import { Link, usePathname } from '@/src/shared/config/i18n';
import { useSearchPaletteShortcut } from '@/src/shared/hooks';
import { SearchPalette, SearchTrigger, type SearchPaletteGroup } from '@/src/shared/ui';

interface SidebarTreeNode {
  slug: string;
  title: string;
  children: SidebarTreeNode[];
}

interface Category {
  key: string;
  label: string;
  noteCount: number;
  tree: SidebarTreeNode[];
}

interface GardenSidebarProps {
  categories: Category[];
}

function flattenTree(nodes: SidebarTreeNode[]): { slug: string; title: string }[] {
  return nodes.flatMap(node => [{ slug: node.slug, title: node.title }, ...flattenTree(node.children)]);
}

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

function TreeContent({
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

const COLLAPSED_STORAGE_KEY = 'garden-sidebar-collapsed';

export function GardenSidebar({ categories }: GardenSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('garden.sidebar');

  const visibleCategories = React.useMemo(() => categories.filter(c => c.noteCount > 0), [categories]);

  const [searchOpen, setSearchOpen] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);

  // ponytail: 접힘 상태는 hydration 후 localStorage로 복원한다. 접어둔 사용자가 재방문하면
  // 첫 프레임에 펼침→접힘 깜빡임이 생길 수 있다. 없애려면 theme처럼 inline script로 승격.
  React.useEffect(() => {
    try {
      if (localStorage.getItem(COLLAPSED_STORAGE_KEY) === '1') setCollapsed(true);
    } catch {}
  }, []);

  const updateCollapsed = (next: boolean) => {
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? '1' : '0');
    } catch {}
  };

  useSearchPaletteShortcut(setSearchOpen);

  const searchGroups = React.useMemo<SearchPaletteGroup[]>(
    () =>
      visibleCategories.map(category => ({
        key: category.key,
        label: category.label,
        items: flattenTree(category.tree).map(note => ({
          id: note.slug,
          label: note.title,
          href: `/garden/${note.slug}`,
          icon: FileText,
        })),
      })),
    [visibleCategories]
  );

  return (
    <>
      <aside className={cn('w-full shrink-0', collapsed ? 'md:w-12' : 'md:w-64')}>
        {/* 데스크톱: 접힘 상태면 아이콘 rail(펼치기 + 검색)만, 펼침 상태면 검색 + PARA 트리 */}
        {collapsed ? (
          <div className="hidden md:sticky md:top-20 md:flex md:flex-col md:items-center md:gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => updateCollapsed(false)}
              aria-label={t('expand')}
            >
              <PanelLeftOpen />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setSearchOpen(true)}
              aria-label={t('searchAria')}
            >
              <SearchIcon />
            </Button>
          </div>
        ) : (
          <div className="hidden md:flex md:flex-col md:gap-3 md:sticky md:top-20 md:max-h-[calc(100svh-7rem)]">
            <div className="flex items-center justify-between gap-2 px-1">
              <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                <FolderTree className="size-4 text-muted-foreground" />
                {t('title')}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => updateCollapsed(true)}
                aria-label={t('collapse')}
                aria-expanded
                aria-controls="garden-note-tree"
              >
                <PanelLeftClose />
              </Button>
            </div>
            <SearchTrigger onClick={() => setSearchOpen(true)} placeholder={t('searchPlaceholder')} />
            <div id="garden-note-tree" className="-mr-2 flex-1 overflow-y-auto overscroll-contain pr-2">
              <TreeContent visibleCategories={visibleCategories} pathname={pathname} />
            </div>
          </div>
        )}

        {/* 모바일: 인라인 검색 + "둘러보기"는 좌측 드로어 대신 바텀시트로 트리를 연다
            (상단 헤더 햄버거와 방향이 겹치지 않게) */}
        <div className="flex items-center gap-2 md:hidden">
          <SearchTrigger
            onClick={() => setSearchOpen(true)}
            placeholder={t('searchPlaceholder')}
            ariaLabel={t('searchAria')}
            showShortcut={false}
            className="flex-1"
          />
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5">
                <FolderTree className="size-4" aria-hidden />
                {t('openTree')}
                <ChevronUp className="size-3.5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="flex max-h-[80svh] flex-col gap-0 px-4 pt-4 pb-6">
              <SheetHeader className="px-0 pb-3">
                <SheetTitle className="flex items-center gap-2 text-base">
                  <FolderTree className="size-4 text-muted-foreground" />
                  {t('title')}
                </SheetTitle>
                <SheetDescription className="sr-only">{t('title')}</SheetDescription>
              </SheetHeader>
              <div className="-mr-2 flex-1 overflow-y-auto overscroll-contain pr-2">
                <TreeContent
                  visibleCategories={visibleCategories}
                  pathname={pathname}
                  onNavigate={() => setSheetOpen(false)}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </aside>

      <SearchPalette
        open={searchOpen}
        onOpenChange={setSearchOpen}
        groups={searchGroups}
        placeholder={t('searchPlaceholder')}
        emptyText={t('searchEmpty')}
        title={t('searchTitle')}
        description={t('searchDescription')}
        onSelect={() => {
          setSheetOpen(false);
        }}
      />
    </>
  );
}
