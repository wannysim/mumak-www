import { Music } from 'lucide-react';

import { cn } from '@mumak/ui/lib/utils';

/** 앨범 아트 이미지. URL 이 없으면 음표 플레이스홀더를 렌더한다. */
export function AlbumArt({ src, alt, className }: { src: string; alt: string; className?: string }) {
  if (!src) {
    return (
      <div className={cn('flex items-center justify-center bg-white/10', className)} aria-label={alt}>
        <Music className="size-1/3 opacity-40" aria-hidden="true" />
      </div>
    );
  }
  return <img src={src} alt={alt} className={cn('object-cover', className)} draggable={false} />;
}
