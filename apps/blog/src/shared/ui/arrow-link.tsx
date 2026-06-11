import { ArrowRight } from 'lucide-react';
import * as React from 'react';

import { cn } from '@mumak/ui/lib/utils';

import { Link } from '@/src/shared/config/i18n';

export function ArrowLink({ className, children, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link
      data-slot="arrow-link"
      className={cn(
        'group inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground',
        className
      )}
      {...props}
    >
      {children}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}
