'use client';

import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@mumak/ui/components/accordion';
import { Badge } from '@mumak/ui/components/badge';
import { Button } from '@mumak/ui/components/button';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@mumak/ui/components/sheet';
import { ScrollArea } from '@mumak/ui/components/scroll-area';
import { cn } from '@mumak/ui/lib/utils';

import { Link, usePathname } from '@/src/shared/config/i18n';

export interface SidebarTreeNode {
  slug: string;
  title: string;
  children: SidebarTreeNode[];
}

interface GardenSidebarProps {
  categories: {
    key: string;
    label: string;
    noteCount: number;
    tree: SidebarTreeNode[];
  }[];
}

function NoteTreeItem({
  node,
  pathname,
  depth = 0,
  closeOnSelect = false,
}: {
  node: SidebarTreeNode;
  pathname: string;
  depth?: number;
  closeOnSelect?: boolean;
}) {
  const isActive = pathname === `/garden/${node.slug}`;
  const hasChildren = node.children.length > 0;
  const isChildActive = hasChildren && hasActiveDescendant(node, pathname);
  const [isOpen, setIsOpen] = useState(isChildActive);

  return (
    <li>
      <div className="flex items-center" style={{ paddingLeft: `${depth * 12}px` }}>
        {hasChildren ? (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="-m-2.5 p-2.5 md:m-0 md:p-0.5 rounded hover:bg-muted/80 transition-colors shrink-0"
            aria-label={isOpen ? 'Collapse' : 'Expand'}
          >
            <ChevronRight
              className={cn('size-3.5 text-muted-foreground transition-transform', isOpen && 'rotate-90')}
            />
          </button>
        ) : (
          <span className="w-4.5 shrink-0" />
        )}
        {closeOnSelect ? (
          <SheetClose asChild>
            <Link
              href={`/garden/${node.slug}`}
              className={cn(
                'block flex-1 rounded-md px-1.5 py-1.5 text-sm transition-colors',
                isActive
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              {node.title}
            </Link>
          </SheetClose>
        ) : (
          <Link
            href={`/garden/${node.slug}`}
            className={cn(
              'block flex-1 rounded-md px-1.5 py-1.5 text-sm transition-colors',
              isActive
                ? 'bg-muted font-medium text-foreground'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            )}
          >
            {node.title}
          </Link>
        )}
      </div>
      {hasChildren && isOpen && (
        <ul className="flex flex-col gap-0.5 mt-0.5">
          {node.children.map(child => (
            <NoteTreeItem
              key={child.slug}
              node={child}
              pathname={pathname}
              depth={depth + 1}
              closeOnSelect={closeOnSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function hasActiveDescendant(node: SidebarTreeNode, pathname: string): boolean {
  return node.children.some(child => pathname === `/garden/${child.slug}` || hasActiveDescendant(child, pathname));
}

export function GardenSidebar({ categories }: GardenSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('garden.sidebar');

  const visibleCategories = categories.filter(category => category.noteCount > 0);
  const defaultValues = visibleCategories.map(category => category.key);

  const renderTree = (closeOnSelect = false) => (
    <ScrollArea className="w-full pr-4 h-[42svh] md:h-[70svh] overflow-hidden">
      <Accordion type="multiple" defaultValue={defaultValues} className="w-full">
        {visibleCategories.map(category => (
          <AccordionItem key={category.key} value={category.key}>
            <AccordionTrigger className="text-sm py-3 font-semibold hover:no-underline">
              <div className="flex items-center gap-2">
                {category.label}
                <Badge variant="secondary" className="font-normal rounded-sm py-0 h-5 px-1.5">
                  {category.noteCount}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="flex flex-col gap-0.5 mt-1">
                {category.tree.map(node => (
                  <NoteTreeItem key={node.slug} node={node} pathname={pathname} closeOnSelect={closeOnSelect} />
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </ScrollArea>
  );

  return (
    <aside className="w-full shrink-0 md:w-64">
      <div className="md:sticky md:top-24">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">PARA Garden</h2>
          <Sheet>
            <SheetTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="md:hidden">
                {t('openTree')}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[56svh] rounded-t-2xl px-4 pb-4 pt-2">
              <SheetHeader className="px-0 pb-2 pt-1">
                <SheetTitle className="text-base">PARA Garden</SheetTitle>
              </SheetHeader>
              {renderTree(true)}
            </SheetContent>
          </Sheet>
        </div>
        <div className="hidden md:block">{renderTree()}</div>
      </div>
    </aside>
  );
}
