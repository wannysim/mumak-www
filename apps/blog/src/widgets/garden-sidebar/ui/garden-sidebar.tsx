'use client';

import { ChevronRight, FileText, FolderTree, SearchIcon } from 'lucide-react';
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

  React.useEffect(() => {
    if (isAncestorOfActive) setOpen(true);
  }, [isAncestorOfActive]);

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

export function GardenSidebar({ categories }: GardenSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('garden.sidebar');

  const visibleCategories = React.useMemo(() => categories.filter(c => c.noteCount > 0), [categories]);

  const [searchOpen, setSearchOpen] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);

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

  const openSearchFromSheet = () => {
    setSheetOpen(false);
    setSearchOpen(true);
  };

  return (
    <>
      <aside className="w-full shrink-0 md:w-64">
        <div className="hidden md:flex md:flex-col md:gap-3 md:sticky md:top-20 md:max-h-[calc(100svh-7rem)]">
          <h2 className="flex items-center gap-2 px-1 text-base font-semibold tracking-tight">
            <FolderTree className="size-4 text-muted-foreground" />
            {t('title')}
          </h2>
          <SearchTrigger onClick={() => setSearchOpen(true)} placeholder={t('searchPlaceholder')} />
          <div className="-mr-2 flex-1 overflow-y-auto overscroll-contain pr-2">
            <TreeContent visibleCategories={visibleCategories} pathname={pathname} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 md:hidden">
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <FolderTree className="size-4 text-muted-foreground" />
            {t('title')}
          </h2>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setSearchOpen(true)}
              aria-label={t('searchAria')}
            >
              <SearchIcon />
            </Button>
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  {t('openTree')}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-[88vw] max-w-sm flex-col gap-0 px-4 pt-4 pb-4">
                <SheetHeader className="px-0 pb-3">
                  <SheetTitle className="flex items-center gap-2 text-base">
                    <FolderTree className="size-4 text-muted-foreground" />
                    {t('title')}
                  </SheetTitle>
                  <SheetDescription className="sr-only">{t('searchDescription')}</SheetDescription>
                </SheetHeader>
                <SearchTrigger
                  onClick={openSearchFromSheet}
                  placeholder={t('searchPlaceholder')}
                  showShortcut={false}
                />
                <div className="-mr-2 mt-3 flex-1 overflow-y-auto overscroll-contain pr-2">
                  <TreeContent
                    visibleCategories={visibleCategories}
                    pathname={pathname}
                    onNavigate={() => setSheetOpen(false)}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
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
