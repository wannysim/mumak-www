'use client';

import type { LucideIcon } from 'lucide-react';

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
        <CommandList>
          <CommandEmpty>{emptyText}</CommandEmpty>
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
      </Command>
    </CommandDialog>
  );
}
