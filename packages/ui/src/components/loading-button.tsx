'use client';

import * as React from 'react';

import { Button } from '@mumak/ui/components/button';
import { Spinner } from '@mumak/ui/components/spinner';
import { cn } from '@mumak/ui/lib/utils';

function LoadingButton({
  children,
  className,
  loading = false,
  loadingLabel,
  onClick,
  'aria-label': ariaLabel,
  'aria-disabled': ariaDisabled,
  'aria-busy': ariaBusy,
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'asChild'> & {
  loading?: boolean;
  loadingLabel: string;
}) {
  return (
    <Button
      {...props}
      data-slot="loading-button"
      className={cn('relative', loading && 'cursor-wait', className)}
      aria-label={loading ? loadingLabel : ariaLabel}
      aria-disabled={loading || props.disabled || (ariaDisabled ?? false)}
      aria-busy={loading || (ariaBusy ?? false)}
      onClick={event => {
        if (loading) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClick?.(event);
      }}
    >
      <span
        data-slot="loading-button-label"
        className={cn('inline-flex items-center justify-center gap-[inherit]', loading && 'invisible')}
        aria-hidden={loading || undefined}
      >
        {children}
      </span>
      {loading && (
        <span
          data-slot="loading-button-indicator"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <Spinner role="presentation" aria-label={undefined} className="motion-reduce:animate-none" />
        </span>
      )}
    </Button>
  );
}

export { LoadingButton };
