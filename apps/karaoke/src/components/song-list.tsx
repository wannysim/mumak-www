import { DragDropProvider } from '@dnd-kit/react';
import { isSortable, useSortable } from '@dnd-kit/react/sortable';
import { GripVertical, Pencil } from 'lucide-react';
import { flushSync } from 'react-dom';

import { Button } from '@mumak/ui/components/button';
import { DrawerClose } from '@mumak/ui/components/drawer';
import { cn } from '@mumak/ui/lib/utils';

import { songsInPlaylist, type Playlist, type SongLibrary } from '@/lib/song-library';
import type { Song } from '@/songs';

function SortableSongRow({
  song,
  index,
  isCurrent,
  onSelect,
  onEdit,
}: {
  song: Song;
  index: number;
  isCurrent: boolean;
  onSelect: (song: Song) => void;
  onEdit: (song: Song) => void;
}) {
  const sortable = useSortable({ id: song.slug, index });

  return (
    <li
      ref={sortable.ref}
      data-dragging={sortable.isDragging ? 'true' : undefined}
      className={cn(
        'border-border relative flex min-h-16 items-stretch border-b transition-[background-color,opacity] duration-150',
        sortable.isDragging && 'bg-muted/70 z-10 opacity-60'
      )}
    >
      <DrawerClose asChild>
        <button
          type="button"
          aria-label={`${song.titleJa} (${song.titleKo})`}
          aria-current={isCurrent ? 'true' : undefined}
          onClick={() => onSelect(song)}
          className={cn(
            'flex min-w-0 flex-1 items-center justify-between gap-3 py-3 text-left',
            isCurrent && 'text-primary'
          )}
        >
          <span className="min-w-0">
            <span lang="ja" className="font-japanese block truncate text-lg font-semibold tracking-[-0.035em]">
              {song.titleJa}
            </span>
            <span className="text-muted-foreground block truncate text-sm">{song.titleKo}</span>
          </span>
          {isCurrent && (
            <span
              aria-hidden="true"
              className="font-utility border-primary shrink-0 border-b pb-0.5 text-[0.5625rem] tracking-[0.12em]"
            >
              NOW
            </span>
          )}
        </button>
      </DrawerClose>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`${song.titleJa} 곡 정보 수정`}
        onClick={() => onEdit(song)}
        className="text-muted-foreground size-12 self-center rounded-none"
      >
        <Pencil className="size-3.5 stroke-[1.5]" />
      </Button>
      <button
        ref={sortable.handleRef}
        type="button"
        data-vaul-no-drag
        aria-label={`${song.titleJa} 순서 이동`}
        className="text-muted-foreground hover:text-foreground flex w-12 shrink-0 touch-none cursor-grab items-center justify-center active:cursor-grabbing"
      >
        <GripVertical className="size-4 stroke-[1.5]" />
      </button>
    </li>
  );
}

export function SongList({
  playlist,
  library,
  current,
  onSelect,
  onEdit,
  onReorder,
}: {
  playlist: Playlist;
  library: SongLibrary;
  current: Song;
  onSelect: (song: Song) => void;
  onEdit: (song: Song) => void;
  onReorder: (songs: Song[]) => void;
}) {
  const songs = songsInPlaylist(library, playlist.id);
  if (songs.length === 0) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-foreground font-medium">아직 곡이 없습니다</p>
        <p className="text-muted-foreground text-sm">오른쪽 위 + 버튼에서 YouTube 영상을 추가하세요.</p>
      </div>
    );
  }

  return (
    <DragDropProvider
      onDragEnd={event => {
        if (event.canceled) return;
        const { source } = event.operation;
        if (!isSortable(source) || source.initialIndex === source.index) return;
        const keyboardHandle =
          event.nativeEvent instanceof KeyboardEvent && source.handle instanceof HTMLElement ? source.handle : null;

        const next = [...songs];
        const [moved] = next.splice(source.initialIndex, 1);
        if (!moved || source.index < 0 || source.index >= songs.length) return;
        next.splice(source.index, 0, moved);
        // dnd-kit wraps callbacks in a transition; commit storage before the drawer can close or reload.
        flushSync(() => onReorder(next));
        if (keyboardHandle) requestAnimationFrame(() => keyboardHandle.focus());
      }}
    >
      <ul
        aria-label={`${playlist.name} 곡 순서`}
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {songs.map((song, index) => (
          <SortableSongRow
            key={song.slug}
            song={song}
            index={index}
            isCurrent={song.slug === current.slug}
            onSelect={onSelect}
            onEdit={onEdit}
          />
        ))}
      </ul>
    </DragDropProvider>
  );
}
