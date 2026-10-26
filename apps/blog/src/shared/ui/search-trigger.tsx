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
    <Button
      ref={ref}
      type="button"
      variant="outline"
      size="lg"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        'w-full justify-between gap-2 px-3 font-normal text-muted-foreground hover:text-foreground',
        className
      )}
    >
      <span className="inline-flex items-center gap-2">
        <SearchIcon className="size-4" />
        <span className="truncate text-sm">{placeholder}</span>
      </span>
      {showShortcut && (
        <KbdGroup className="hidden md:inline-flex">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      )}
    </Button>
  );
}
