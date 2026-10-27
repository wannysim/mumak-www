import * as React from 'react';

import { Button, buttonVariants } from '@mumak/ui/components/button';
import { cn } from '@mumak/ui/lib/utils';

// A native ghost button with reserved target space, not an overlapping hit-area overlay.
// Radix Trigger/Close asChild can forward their ref and state to this single button.
function IconButton({
  children,
  className,
  surfaceSize = 'sm',
  surfaceClassName,
  type = 'button',
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'asChild' | 'size' | 'variant'> & {
  'aria-label': string;
  surfaceSize?: 'sm' | 'lg';
  surfaceClassName?: string;
}) {
  return (
    <Button
      {...props}
      type={type}
      variant="ghost"
      size="icon"
      data-slot="icon-button"
      className={cn(
        'size-11 bg-transparent hover:bg-transparent aria-expanded:bg-transparent dark:hover:bg-transparent',
        className
      )}
    >
      <span
        data-slot="icon-button-surface"
        aria-hidden="true"
        className={cn(
          buttonVariants({ variant: 'ghost', size: surfaceSize === 'lg' ? 'icon-lg' : 'icon-sm' }),
          'pointer-events-none group-aria-expanded/button:bg-muted [@media(hover:hover)]:group-hover/button:bg-muted dark:[@media(hover:hover)]:group-hover/button:bg-muted/50',
          surfaceClassName
        )}
      >
        {children}
      </span>
    </Button>
  );
}

export { IconButton };
