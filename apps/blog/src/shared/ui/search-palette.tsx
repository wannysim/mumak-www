'use client';

import type { LucideIcon } from 'lucide-react';
import * as React from 'react';

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@mumak/ui/components/command';

import { useRouter } from '@/src/shared/config/i18n';

export interface SearchPaletteItem {
  id: string;
  label: string;
  href: string;
  searchKeywords?: string;
  icon?: LucideIcon;
  hint?: string;
}

export interface SearchPaletteGroup {
  key: string;
  label: string;
  items: SearchPaletteItem[];
}

interface SearchPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: SearchPaletteGroup[];
  placeholder: string;
  emptyText: string;
  title: string;
  description: string;
  onSelect?: (item: SearchPaletteItem) => void;
  // 결과 목록 아래 고정되는 보조 영역(검색 범위 전환 등). CommandList 밖에 두어
  // 입력 중 필터링에 영향받지 않고 항상 보이게 한다.
  footer?: React.ReactNode;
  // 인덱스를 아직 받지 못한 구간. "결과 없음"과 "아직 못 받았음"은 다른 상태다.
  loading?: boolean;
  loadingText?: string;
}

export function SearchPalette({
  open,
  onOpenChange,
  groups,
  placeholder,
  emptyText,
  title,
  description,
  onSelect,
  footer,
  loading = false,
  loadingText,
}: SearchPaletteProps) {
  const router = useRouter();

  const handleSelect = (item: SearchPaletteItem) => {
    onOpenChange(false);
    onSelect?.(item);
    router.push(item.href);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <Command>
        <CommandInput placeholder={placeholder} />
        {/* cmdk가 CommandList에 role="listbox"를 직접 박아서 밖에서 못 바꾼다. 그런데 빈
            listbox는 option을 하나도 소유하지 않아 aria-required-children 위반이다(로딩 구간,
            일치 결과 0건). CommandEmpty는 role="presentation"이라 접근성 트리에서 사라지므로,
            그 안의 행에 role="option"을 주면 listbox가 소유한 유일한 option이 되어 유효해진다.
            로딩 중에는 aria-busy로 "지금 채우는 중"임을 함께 알린다. */}
        <CommandList aria-busy={loading || undefined}>
          <CommandEmpty>
            <span role="option" aria-disabled="true" aria-selected={false}>
              {loading ? (loadingText ?? emptyText) : emptyText}
            </span>
          </CommandEmpty>
          {groups.map(group => (
            <CommandGroup key={group.key} heading={group.label}>
              {group.items.map(item => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={`${group.key}/${item.id}`}
                    value={`${item.label} ${group.label} ${item.searchKeywords ?? ''} ${item.id}`}
                    onSelect={() => handleSelect(item)}
                  >
                    {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
                    <span className="truncate">{item.label}</span>
                    {item.hint ? <span className="ml-auto text-xs text-muted-foreground">{item.hint}</span> : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
        {footer ? <div className="border-t border-border px-3 py-2">{footer}</div> : null}
      </Command>
    </CommandDialog>
  );
}
