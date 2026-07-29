import { Repeat, Repeat1 } from 'lucide-react';

import { Button } from '@mumak/ui/components/button';
import { cn } from '@mumak/ui/lib/utils';

import { nextPlaybackMode, PLAYBACK_MODE_LABEL, type PlaybackMode } from '@/lib/playback-mode';

export function PlaybackModeToggle({ mode, onChange }: { mode: PlaybackMode; onChange: (mode: PlaybackMode) => void }) {
  const Icon = mode === 'one' ? Repeat1 : Repeat;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative size-11 rounded-none hover:bg-transparent"
      aria-label={`재생 모드: ${PLAYBACK_MODE_LABEL[mode]}`}
      aria-pressed={mode !== 'off'}
      onClick={() => onChange(nextPlaybackMode(mode))}
    >
      {/* 꺼진 상태도 같은 아이콘을 흐리게 두어야 버튼 위치가 흔들리지 않는다. */}
      <Icon
        className={cn(
          'size-5 transition-[color,opacity] duration-150',
          mode === 'off' ? 'text-muted-foreground' : 'text-primary'
        )}
      />
      {mode !== 'off' && <span className="bg-primary absolute bottom-1.5 h-px w-3" />}
    </Button>
  );
}
