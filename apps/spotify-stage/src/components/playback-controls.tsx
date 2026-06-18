import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@mumak/ui/lib/utils';

import {
  type ControlResult,
  pausePlayback,
  resumePlayback,
  setRepeat,
  setShuffle,
  skipNext,
  skipPrevious,
} from '@/lib/spotify/playback';
import type { NowPlaying, RepeatState } from '@/lib/spotify/types';

const ERROR_MESSAGE: Record<Exclude<ControlResult, { ok: true }>['reason'], string> = {
  premium: 'Spotify Premium이 필요해요',
  scope: '로그아웃 후 다시 로그인하면 조작 권한이 생겨요',
  'no-device': '활성 기기가 없어요. Spotify에서 재생을 시작하세요',
  auth: '인증이 만료됐어요',
  error: '잠시 후 다시 시도해 주세요',
};

const NEXT_REPEAT: Record<RepeatState, RepeatState> = {
  off: 'context',
  context: 'track',
  track: 'off',
};

function iconButton(active: boolean): string {
  return cn(
    'flex items-center justify-center rounded-full transition disabled:opacity-40',
    active ? 'text-emerald-400' : 'text-white/70 hover:text-white'
  );
}

/**
 * 실제 활성 기기를 제어하는 재생 컨트롤 바.
 * 조작 후 onChanged 로 즉시 + 잠시 뒤 한 번 더 새로고침해 상태 반영 지연을 줄인다.
 */
export function PlaybackControls({ nowPlaying, onChanged }: { nowPlaying: NowPlaying; onChanged: () => void }) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = (action: () => Promise<ControlResult>) => async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    const result = await action();
    setBusy(false);

    if (result.ok) {
      setMessage(null);
      onChanged();
      window.setTimeout(onChanged, 600);
    } else {
      setMessage(ERROR_MESSAGE[result.reason]);
      window.setTimeout(() => setMessage(null), 3200);
    }
  };

  const RepeatIcon = nowPlaying.repeatState === 'track' ? Repeat1 : Repeat;

  return (
    <div className="fixed inset-x-0 bottom-6 z-20 flex flex-col items-center gap-2">
      {message ? (
        <p className="rounded-full bg-black/60 px-3 py-1 text-xs text-white/90 backdrop-blur-md" role="status">
          {message}
        </p>
      ) : null}

      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-2 backdrop-blur-xl">
        <button
          onClick={run(() => setShuffle(!nowPlaying.shuffleState))}
          className={cn(iconButton(nowPlaying.shuffleState), 'size-9')}
          disabled={busy}
          aria-label="셔플"
          aria-pressed={nowPlaying.shuffleState}
        >
          <Shuffle className="size-4" aria-hidden="true" />
        </button>

        <button
          onClick={run(skipPrevious)}
          className={cn(iconButton(false), 'size-10')}
          disabled={busy}
          aria-label="이전 곡"
        >
          <SkipBack className="size-5" aria-hidden="true" />
        </button>

        <button
          onClick={run(nowPlaying.isPlaying ? pausePlayback : resumePlayback)}
          className="flex size-12 items-center justify-center rounded-full bg-white text-black transition hover:scale-105 disabled:opacity-40"
          disabled={busy}
          aria-label={nowPlaying.isPlaying ? '일시정지' : '재생'}
        >
          {nowPlaying.isPlaying ? (
            <Pause className="size-5" aria-hidden="true" />
          ) : (
            <Play className="size-5 translate-x-0.5" aria-hidden="true" />
          )}
        </button>

        <button
          onClick={run(skipNext)}
          className={cn(iconButton(false), 'size-10')}
          disabled={busy}
          aria-label="다음 곡"
        >
          <SkipForward className="size-5" aria-hidden="true" />
        </button>

        <button
          onClick={run(() => setRepeat(NEXT_REPEAT[nowPlaying.repeatState]))}
          className={cn(iconButton(nowPlaying.repeatState !== 'off'), 'size-9')}
          disabled={busy}
          aria-label="반복"
          aria-pressed={nowPlaying.repeatState !== 'off'}
        >
          <RepeatIcon className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
