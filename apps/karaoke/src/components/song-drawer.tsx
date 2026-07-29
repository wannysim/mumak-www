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
  const currentIndex = Math.max(
    0,
    songs.findIndex(song => song.slug === current.slug)
  );
  const trackPosition = `${String(currentIndex + 1).padStart(2, '0')} / ${String(songs.length).padStart(2, '0')}`;

  return (
    <Drawer>
      <h1 className="min-w-0 flex-1">
        <DrawerTrigger asChild>
          <Button
            variant="ghost"
            aria-label={`${current.titleJa} — 곡 목록 열기`}
            className="h-16 w-full flex-col items-center gap-0 rounded-none px-2 hover:bg-transparent"
          >
            <span className="font-utility text-muted-foreground mb-0.5 text-[0.5625rem] leading-none tracking-[0.18em]">
              {trackPosition}
            </span>
            <span
              lang="ja"
              className="font-japanese w-full truncate text-xl leading-tight font-semibold tracking-[-0.045em]"
            >
              {current.titleJa}
            </span>
            <span className="text-muted-foreground mt-0.5 w-full truncate text-[0.625rem] leading-none font-normal tracking-[0.04em]">
              {current.titleKo}
            </span>
          </Button>
        </DrawerTrigger>
      </h1>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>곡 선택</DrawerTitle>
        </DrawerHeader>
        <ul className="max-h-[50svh] overflow-y-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {songs.map(song => {
            const isCurrent = song.slug === current.slug;

            return (
              <li key={song.slug}>
                <DrawerClose asChild>
                  <button
                    type="button"
                    aria-label={`${song.titleJa} (${song.titleKo})`}
                    aria-current={isCurrent ? 'true' : undefined}
                    onClick={() => onSelect(song)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 border-b py-4 text-left',
                      isCurrent && 'text-primary'
                    )}
                  >
                    <span className="min-w-0">
                      <span
                        lang="ja"
                        className="font-japanese block truncate text-lg font-semibold tracking-[-0.035em]"
                      >
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
              </li>
            );
          })}
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
