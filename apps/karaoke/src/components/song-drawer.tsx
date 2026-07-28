import { Info } from 'lucide-react';

import { Button } from '@mumak/ui/components/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@mumak/ui/components/drawer';
import { cn } from '@mumak/ui/lib/utils';

import type { Song } from '@/songs';

export function SongDrawer({
  songs,
  current,
  onSelect,
  onAbout,
}: {
  songs: Song[];
  current: Song;
  onSelect: (song: Song) => void;
  onAbout: () => void;
}) {
  return (
    <Drawer>
      <h1 className="min-w-0 flex-1">
        <DrawerTrigger asChild>
          <Button
            variant="ghost"
            aria-label={`${current.titleJa} — 곡 목록 열기`}
            className="h-12 w-full flex-col items-center gap-0 px-2"
          >
            <span lang="ja" className="w-full truncate text-base font-bold">
              {current.titleJa}
            </span>
            <span className="text-muted-foreground w-full truncate text-xs font-normal">{current.titleKo}</span>
          </Button>
        </DrawerTrigger>
      </h1>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>곡 선택</DrawerTitle>
        </DrawerHeader>
        <ul className="max-h-[50svh] overflow-y-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {songs.map(song => (
            <li key={song.slug}>
              <DrawerClose asChild>
                <button
                  type="button"
                  aria-label={`${song.titleJa} (${song.titleKo})`}
                  onClick={() => onSelect(song)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 border-b py-4 text-left',
                    song.slug === current.slug && 'text-primary'
                  )}
                >
                  <span className="min-w-0">
                    <span lang="ja" className="block truncate font-semibold">
                      {song.titleJa}
                    </span>
                    <span className="text-muted-foreground block truncate text-sm">{song.titleKo}</span>
                  </span>
                </button>
              </DrawerClose>
            </li>
          ))}
        </ul>
        {/* 드로어 중첩을 피하려고 목록을 닫고 나서 About을 연다. */}
        <div className="px-4 pt-2 pb-8">
          <DrawerClose asChild>
            <button
              type="button"
              onClick={onAbout}
              className="text-muted-foreground hover:text-foreground flex min-h-11 w-full items-center gap-2 text-left text-sm"
            >
              <Info className="size-4 shrink-0" />
              이 앱에 대해 · 곡 추가 요청
            </button>
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
