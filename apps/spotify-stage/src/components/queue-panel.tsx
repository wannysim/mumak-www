import { ListMusic, Music, X } from 'lucide-react';
import { useState } from 'react';

import { useUpNext } from '@/hooks/use-up-next';
import type { TrackBrief } from '@/lib/spotify/types';

function TrackRow({ track }: { track: TrackBrief }) {
  return (
    <li className="flex items-center gap-2.5">
      {track.albumImageUrl ? (
        <img src={track.albumImageUrl} alt="" className="size-9 shrink-0 rounded object-cover" draggable={false} />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded bg-white/10">
          <Music className="size-4 opacity-40" aria-hidden="true" />
        </span>
      )}
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm text-zinc-100">{track.title}</span>
        <span className="truncate text-xs text-zinc-400">{track.artist}</span>
      </span>
    </li>
  );
}

function TrackList({ title, tracks, empty }: { title: string; tracks: TrackBrief[]; empty: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h3>
      {tracks.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {tracks.map((track, index) => (
            <TrackRow key={`${track.songUrl}-${index}`} track={track} />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-zinc-500">{empty}</p>
      )}
    </section>
  );
}

/** 좌측 토글 패널: 방금 들은 곡(Just Played) + 다음 대기열(Up Next). */
export function QueuePanel({ currentSongUrl }: { currentSongUrl: string }) {
  const [open, setOpen] = useState(false);
  const { upNext, justPlayed } = useUpNext(currentSongUrl, open);

  return (
    <>
      <button
        onClick={() => setOpen(value => !value)}
        className="fixed left-4 top-4 z-20 flex size-9 items-center justify-center rounded-full bg-black/30 text-white/70 backdrop-blur-md transition hover:bg-black/50 hover:text-white"
        aria-label="대기열 보기"
        aria-expanded={open}
        title="대기열"
      >
        <ListMusic className="size-4" aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed left-4 top-16 z-30 flex max-h-[80vh] w-72 flex-col gap-5 overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900/90 p-5 text-zinc-100 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">대기열</h2>
            <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white" aria-label="닫기">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <TrackList title="Up Next" tracks={upNext} empty="다음 대기열이 비어 있어요" />
          <TrackList title="Just Played" tracks={justPlayed} empty="최근 재생 기록이 없어요" />
        </div>
      ) : null}
    </>
  );
}
