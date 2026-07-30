'use client';

import { ChevronUp, FolderTree, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { Button } from '@mumak/ui/components/button';
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

import { type Category } from '../model/note-tree';
import { useCollapsedState } from '../model/use-collapsed-state';
import { TreeContent } from './note-tree';

interface GardenSidebarProps {
  categories: Category[];
}

export function GardenSidebar({ categories }: GardenSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('garden.sidebar');

  const visibleCategories = React.useMemo(() => categories.filter(c => c.noteCount > 0), [categories]);

  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [collapsed, updateCollapsed] = useCollapsedState();

  return (
    <aside className={cn('w-full shrink-0', collapsed ? 'md:w-12' : 'md:w-64')}>
      {/* 데스크톱: 접힘 상태면 펼치기 아이콘만, 펼침 상태면 PARA 트리.
            검색은 헤더의 전역 팔레트가 담당한다(섹션별 검색창 없음). */}
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
          <div id="garden-note-tree" className="-mr-2 flex-1 overflow-y-auto overscroll-contain pr-2">
            <TreeContent visibleCategories={visibleCategories} pathname={pathname} />
          </div>
        </div>
      )}

      {/* 모바일: "둘러보기"는 좌측 드로어 대신 바텀시트로 트리를 연다
            (상단 헤더 햄버거와 방향이 겹치지 않게) */}
      <div className="md:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="w-full justify-center gap-1.5">
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
  );
}
