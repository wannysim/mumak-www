'use client';

import { ChevronUp, FileText, FolderTree, PanelLeftClose, PanelLeftOpen, SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { Button } from '@mumak/ui/components/button';
import { ScrollArea } from '@mumak/ui/components/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@mumak/ui/components/sheet';
import { cn } from '@mumak/ui/lib/utils';

import { usePathname } from '@/src/shared/config/i18n';
import { useSearchPaletteShortcut } from '@/src/shared/hooks';
import { SearchPalette, SearchTrigger, type SearchPaletteGroup } from '@/src/shared/ui';

import { type Category, flattenTree } from '../model/note-tree';
import { useCollapsedState } from '../model/use-collapsed-state';
import { TreeContent } from './note-tree';

interface GardenSidebarProps {
  categories: Category[];
}

export function GardenSidebar({ categories }: GardenSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('garden.sidebar');

  const visibleCategories = React.useMemo(() => categories.filter(c => c.noteCount > 0), [categories]);

  const [searchOpen, setSearchOpen] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [collapsed, updateCollapsed] = useCollapsedState();

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
            <ScrollArea
              id="garden-note-tree"
              className="-mr-2 min-h-0 flex-1 pr-2 [&_[data-slot=scroll-area-viewport]]:overscroll-contain"
            >
              <TreeContent visibleCategories={visibleCategories} pathname={pathname} />
            </ScrollArea>
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
              <ScrollArea className="-mr-2 min-h-0 flex-1 pr-2 [&_[data-slot=scroll-area-viewport]]:overscroll-contain">
                <TreeContent
                  visibleCategories={visibleCategories}
                  pathname={pathname}
                  onNavigate={() => setSheetOpen(false)}
                />
              </ScrollArea>
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
