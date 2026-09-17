import Image from 'next/image';
import type * as React from 'react';

import { cn } from '@mumak/ui/lib/utils';

function ContentImage({
  src,
  zoomSrc = src,
  sizes = '(max-width: 768px) calc(100vw - 2rem), 768px',
  className,
  ...props
}: Omit<React.ComponentProps<typeof Image>, 'src'> & { src: string; zoomSrc?: string }) {
  return (
    <Image
      {...props}
      src={src}
      sizes={sizes}
      data-zoom-src={zoomSrc}
      className={cn('my-4 h-auto max-w-full rounded-lg', className)}
    />
  );
}

export { ContentImage };
