'use client';

import { SearchIcon } from 'lucide-react';
import type { MouseEventHandler, Ref } from 'react';

import { Button } from '@mumak/ui/components/button';
import { Kbd, KbdGroup } from '@mumak/ui/components/kbd';
import { cn } from '@mumak/ui/lib/utils';

interface SearchTriggerProps {
  ref?: Ref<HTMLButtonElement>;
  onClick: MouseEventHandler<HTMLButtonElement>;
  placeholder: string;
  showShortcut?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function SearchTrigger({
  ref,
  onClick,
  placeholder,
  showShortcut = true,
  className,
  ariaLabel,
}: SearchTriggerProps) {
  return (
    <div data-slot="search-trigger" className={cn('relative shrink-0', className)}>
      <Button
        ref={ref}
        type="button"
        variant="outline"
        size="lg"
        onClick={onClick}
        aria-label={ariaLabel}
        aria-keyshortcuts={showShortcut ? 'Meta+K Control+K' : undefined}
        className={cn(
          'w-full justify-between gap-2 px-3 font-normal text-muted-foreground hover:text-foreground',
          showShortcut && 'md:pr-18'
        )}
      >
        <span className="inline-flex items-center gap-2">
          <SearchIcon className="size-4" />
          <span className="truncate text-sm">{placeholder}</span>
        </span>
      </Button>
      {showShortcut && (
        <KbdGroup
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 md:inline-flex"
        >
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      )}
    </div>
  );
}
