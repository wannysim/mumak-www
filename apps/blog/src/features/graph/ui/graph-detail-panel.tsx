'use client';

import { ArrowRightIcon, LinkIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@mumak/ui/components/badge';
import { Button } from '@mumak/ui/components/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@mumak/ui/components/drawer';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@mumak/ui/components/sheet';

import type { GraphNode } from '../model/types';

interface GraphDetailPanelProps {
  node: GraphNode | null;
  open: boolean;
  onClose: () => void;
  locale: string;
  labels: {
    description: string;
    close: string;
    viewDetail: string;
    connections: string;
    type: Record<string, string>;
    status: Record<string, string>;
    category: Record<string, string>;
  };
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

function NodeDetail({ node, locale, labels }: Omit<GraphDetailPanelProps, 'open' | 'onClose'>) {
  if (!node) return null;

  const statusVariant = node.status === 'evergreen' ? 'default' : node.status === 'budding' ? 'secondary' : 'outline';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{labels.type[node.type] ?? node.type}</Badge>
        {node.status && <Badge variant={statusVariant}>{labels.status[node.status] ?? node.status}</Badge>}
        {/* 캔버스 라벨·필터 옵션·범례가 모두 지역화된 분류 문구를 쓰므로 배지도 같은 어휘를 쓴다. */}
        {node.category && <Badge variant="secondary">{labels.category[node.category] ?? node.category}</Badge>}
      </div>

      {node.description && <p className="text-sm text-muted-foreground">{node.description}</p>}

      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <LinkIcon className="h-3.5 w-3.5" />
        <span>
          {node.linkCount} {labels.connections}
        </span>
      </div>

      {node.url && (
        <Button asChild variant="default" size="sm" className="w-full">
          <a href={`/${locale}${node.url}`}>
            {labels.viewDetail}
            <ArrowRightIcon className="h-4 w-4 ml-1" />
          </a>
        </Button>
      )}
    </div>
  );
}

function GraphDetailPanel({ node, open, onClose, locale, labels }: GraphDetailPanelProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  if (isDesktop) {
    return (
      <Sheet open={open} onOpenChange={isOpen => !isOpen && onClose()}>
        {/* SheetContent가 이미 닫기 버튼을 그린다. 별도 SheetClose를 더하면 같은 동작의 컨트롤이
            두 개가 되므로 이름만 지역화해서 넘긴다. */}
        <SheetContent side="right" className="w-80" closeLabel={labels.close}>
          <SheetHeader>
            <SheetTitle>{node?.name ?? ''}</SheetTitle>
            <SheetDescription className="sr-only">{labels.description}</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <NodeDetail node={node} locale={locale} labels={labels} />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Drawer open={open} onOpenChange={isOpen => !isOpen && onClose()}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>{node?.name ?? ''}</DrawerTitle>
          <DrawerDescription className="sr-only">{labels.description}</DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-6">
          <NodeDetail node={node} locale={locale} labels={labels} />
        </div>
        <DrawerClose className="sr-only">{labels.close}</DrawerClose>
      </DrawerContent>
    </Drawer>
  );
}

export { GraphDetailPanel };
export type { GraphDetailPanelProps };
