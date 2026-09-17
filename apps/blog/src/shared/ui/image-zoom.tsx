'use client';

import { XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { Button } from '@mumak/ui/components/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@mumak/ui/components/dialog';
import { cn } from '@mumak/ui/lib/utils';

function ImageZoom({ children, className }: Pick<React.ComponentProps<'button'>, 'children' | 'className'>) {
  const t = useTranslations('imageViewer');
  const [image, setImage] = React.useState<{ src: string; alt: string; width?: number; height?: number }>();

  function selectImage(event: React.MouseEvent<HTMLButtonElement>) {
    const image = event.currentTarget.querySelector('img');
    if (!image) return;
    const width = image.dataset.zoomSrc ? Number(image.getAttribute('width')) : image.naturalWidth;
    const height = image.dataset.zoomSrc ? Number(image.getAttribute('height')) : image.naturalHeight;

    setImage({
      src: image.dataset.zoomSrc || image.currentSrc || image.src,
      alt: image.alt,
      width: width || Number(image.getAttribute('width')) || undefined,
      height: height || Number(image.getAttribute('height')) || undefined,
    });
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          data-slot="image-zoom-trigger"
          className={cn(
            'inline-block max-w-full cursor-zoom-in rounded-lg align-middle [&_img]:m-0 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg',
            className
          )}
          onClick={selectImage}
        >
          <span className="sr-only">{t('open')}</span>
          {children}
        </button>
      </DialogTrigger>
      <DialogContent
        className="w-max max-w-[calc(100%-2rem)] grid-cols-1 gap-3 p-3 sm:max-w-[calc(100%-4rem)] motion-reduce:animate-none"
        showCloseButton={false}
        {...(!image?.alt && { 'aria-describedby': undefined })}
      >
        <div className="flex items-center justify-between gap-4">
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" aria-label={t('close')}>
              <XIcon />
            </Button>
          </DialogClose>
        </div>
        {image && (
          <figure
            className="min-w-0 max-w-full"
            style={
              image.width && image.height
                ? {
                    width: `min(${image.width}px, calc((100svh - 14rem) * ${image.width / image.height}))`,
                  }
                : undefined
            }
          >
            {/* oxlint-disable-next-line next/no-img-element -- The lightbox displays the full published rendition, not a resized thumbnail. */}
            <img
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              decoding="async"
              className="mx-auto block h-auto max-h-[calc(100svh-14rem)] w-full max-w-full rounded-md object-contain"
            />
            {image.alt && (
              <DialogDescription asChild className="mt-3 max-h-24 overflow-y-auto break-words text-center">
                <figcaption>{image.alt}</figcaption>
              </DialogDescription>
            )}
          </figure>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { ImageZoom };
