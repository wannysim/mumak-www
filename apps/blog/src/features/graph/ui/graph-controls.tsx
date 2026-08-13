'use client';

import { FilterIcon, SearchIcon, XIcon } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Badge } from '@mumak/ui/components/badge';
import { Button } from '@mumak/ui/components/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@mumak/ui/components/command';
import { Input } from '@mumak/ui/components/input';
import { Popover, PopoverContent, PopoverTrigger } from '@mumak/ui/components/popover';

import type { GraphData, GraphTab } from '../model/types';

interface GraphControlsProps {
  data: GraphData;
  activeTab: GraphTab;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeFilters: string[];
  onFilterToggle: (filter: string) => void;
  onClearFilters: () => void;
  labels: {
    search: string;
    filter: string;
    clearFilters: string;
    noResults: string;
    status: string;
    tags: string;
    categories: string;
  };
  // 필터 키(`status:seedling`, `category:essay`) → 표시 문구. 범례와 같은 맵을 받는다.
  // 같은 화면에서 한쪽은 '씨앗', 다른 쪽은 'seedling'으로 갈리지 않게 하는 단일 소스다.
  // 태그 키는 이 맵에 없고 사용자 콘텐츠라 원문 그대로 떨어진다.
  optionLabels: Record<string, string>;
}

function extractFilterOptions(data: GraphData, activeTab: GraphTab) {
  const statuses = new Set<string>();
  const tags = new Set<string>();
  const categories = new Set<string>();

  for (const node of data.nodes) {
    if (node.type === 'tag') tags.add(node.name);
    // 분류는 글 노드의 category(원문 슬러그)에서 모은다. 카테고리 노드의 name은
    // 캔버스 표시용 지역화 문구라 필터 키(`category:essay`)로 쓸 수 없다.
    if (node.type === 'post' && node.category) categories.add(node.category);
    if (node.type === 'note' && node.status) statuses.add(node.status);
  }

  return { statuses: [...statuses], tags: [...tags], categories: [...categories], activeTab };
}

function GraphControls({
  data,
  activeTab,
  searchQuery,
  onSearchChange,
  activeFilters,
  onFilterToggle,
  onClearFilters,
  labels,
  optionLabels,
}: GraphControlsProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const options = extractFilterOptions(data, activeTab);

  const handleSelect = useCallback(onFilterToggle, [onFilterToggle]);
  const labelFor = (key: string) => optionLabels[key] ?? (key.split(':').slice(1).join(':') || key);

  return (
    <div className="absolute top-14 left-3 z-10 flex flex-col gap-2">
      <div className="hidden md:block relative max-w-xs">
        <SearchIcon className="pointer-events-none absolute z-10 left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={labels.search}
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className="pl-9 bg-background/80 backdrop-blur-sm"
        />
      </div>

      <div className="md:hidden flex items-center gap-2">
        {searchExpanded ? (
          <div className="relative flex-1 max-w-[200px]">
            <SearchIcon className="pointer-events-none absolute z-10 left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={labels.search}
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className="pl-9 h-9 bg-background/80 backdrop-blur-sm text-sm"
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- 사용자가 검색을 직접 펼칠 때만 포커스 이동(의도된 UX)
              autoFocus
              onBlur={() => !searchQuery && setSearchExpanded(false)}
            />
          </div>
        ) : (
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 bg-background/80 backdrop-blur-sm"
            onClick={() => setSearchExpanded(true)}
          >
            <SearchIcon className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="relative h-9 w-9 bg-background/80 backdrop-blur-sm"
              aria-label={labels.filter}
            >
              <FilterIcon className="h-4 w-4" />
              {activeFilters.length > 0 && (
                <Badge
                  variant="secondary"
                  className="h-5 w-5 p-0 flex items-center justify-center text-xs absolute -top-1.5 -right-1.5"
                >
                  {activeFilters.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command>
              <CommandInput placeholder={labels.search} />
              <CommandList>
                <CommandEmpty>{labels.noResults}</CommandEmpty>
                {activeTab === 'garden' && options.statuses.length > 0 && (
                  <CommandGroup heading={labels.status}>
                    {options.statuses.map(status => (
                      <CommandItem key={`status:${status}`} onSelect={() => handleSelect(`status:${status}`)}>
                        <span className={activeFilters.includes(`status:${status}`) ? 'font-semibold' : ''}>
                          {labelFor(`status:${status}`)}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {activeTab === 'blog' && options.categories.length > 0 && (
                  <CommandGroup heading={labels.categories}>
                    {options.categories.map(cat => (
                      <CommandItem key={`category:${cat}`} onSelect={() => handleSelect(`category:${cat}`)}>
                        <span className={activeFilters.includes(`category:${cat}`) ? 'font-semibold' : ''}>
                          {labelFor(`category:${cat}`)}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {options.tags.length > 0 && (
                  <CommandGroup heading={labels.tags}>
                    {options.tags.map(tag => (
                      <CommandItem key={`tag:${tag}`} onSelect={() => handleSelect(`tag:${tag}`)}>
                        <span className={activeFilters.includes(`tag:${tag}`) ? 'font-semibold' : ''}>{tag}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {activeFilters.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-8 px-2"
            aria-label={labels.clearFilters}
          >
            <XIcon className="h-3 w-3" />
          </Button>
        )}
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-1 max-w-[200px] md:max-w-xs">
          {activeFilters.map(filter => (
            <Badge
              key={filter}
              variant="secondary"
              className="cursor-pointer bg-background/80 backdrop-blur-sm text-xs"
              onClick={() => onFilterToggle(filter)}
            >
              {labelFor(filter)}
              <XIcon className="h-3 w-3 ml-1" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export { GraphControls };
export type { GraphControlsProps };
