import { Pause, Play } from 'lucide-react';

import { cn } from '@mumak/ui/lib/utils';

/** explicit 트랙 표시(E). */
export function ExplicitTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-4 items-center justify-center rounded-sm bg-white/70 text-[10px] font-bold text-black',
        className
      )}
      aria-label="가사 수위 높음(Explicit)"
      title="Explicit"
    >
      E
    </span>
  );
}

/** 재생/일시정지 상태 칩. */
export function PlayStateChip({ isPlaying, className }: { isPlaying: boolean; className?: string }) {
  const Icon = isPlaying ? Play : Pause;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs uppercase tracking-wider opacity-70', className)}>
      <Icon className="size-3" aria-hidden="true" />
      {isPlaying ? 'Now Playing' : 'Paused'}
    </span>
  );
}
