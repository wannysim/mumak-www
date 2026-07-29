import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SongDrawer } from '../components/song-drawer';
import { addPlaylist, saveSongToPlaylist, type SongLibrary } from '../lib/song-library';
import type { Song } from '../songs';

vi.mock('@dnd-kit/react', () => ({
  DragDropProvider: ({ children, onDragEnd }: { children: React.ReactNode; onDragEnd: (event: unknown) => void }) => (
    <>
      {children}
      <button
        type="button"
        onClick={() =>
          onDragEnd({
            canceled: false,
            nativeEvent: new KeyboardEvent('keyup'),
            operation: {
              source: {
                initialIndex: 0,
                index: 1,
                handle: document.querySelector('[aria-label="怪獣の花唄 순서 이동"]'),
              },
            },
          })
        }
      >
        테스트 드롭
      </button>
    </>
  ),
}));

vi.mock('@dnd-kit/react/sortable', () => ({
  isSortable: () => true,
  useSortable: () => ({
    ref: undefined,
    handleRef: undefined,
    isDragging: false,
  }),
}));

const songA: Song = { slug: 'a', titleJa: '怪獣の花唄', titleKo: '괴수의 꽃노래', videoId: 'aaaaaaaaaaa' };
const songB: Song = { slug: 'b', titleJa: '踊り子', titleKo: '오도리코', videoId: 'bbbbbbbbbbb' };
const library: SongLibrary = {
  schemaVersion: 2,
  songs: [songA, songB],
  playlists: [{ id: 'test', name: '테스트 목록', songSlugs: ['a', 'b'] }],
};

function SongDrawerHarness({
  initialLibrary = library,
  initialPlaylistId = 'test',
  initialSongSlug = 'a',
}: {
  initialLibrary?: SongLibrary;
  initialPlaylistId?: string;
  initialSongSlug?: string;
}) {
  const [storedLibrary, setStoredLibrary] = React.useState(initialLibrary);
  const [storedPlaylistId, setStoredPlaylistId] = React.useState(initialPlaylistId);
  const [storedSongSlug, setStoredSongSlug] = React.useState(initialSongSlug);
  const playlist =
    storedLibrary.playlists.find(candidate => candidate.id === storedPlaylistId) ?? storedLibrary.playlists[0]!;
  const songSlug = playlist.songSlugs.includes(storedSongSlug) ? storedSongSlug : playlist.songSlugs[0]!;
  const current = storedLibrary.songs.find(song => song.slug === songSlug) ?? storedLibrary.songs[0]!;

  return (
    <SongDrawer
      library={storedLibrary}
      currentPlaylistId={playlist.id}
      current={current}
      onSelect={(playlistId, song) => {
        setStoredPlaylistId(playlistId);
        setStoredSongSlug(song.slug);
      }}
      onLibraryChange={setStoredLibrary}
    />
  );
}

describe('SongDrawer', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the current song position with a padded total', () => {
    render(
      <SongDrawer
        library={library}
        currentPlaylistId="test"
        current={songB}
        onSelect={() => {}}
        onLibraryChange={() => {}}
      />
    );

    expect(screen.getByText('02 / 02')).toBeInTheDocument();
  });

  it('navigates to playlists and selects a song', async () => {
    const onSelect = vi.fn();
    render(
      <SongDrawer
        library={library}
        currentPlaylistId="test"
        current={songA}
        onSelect={onSelect}
        onLibraryChange={() => {}}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /곡 목록 열기/ }));
    expect(await screen.findByText('테스트 목록')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '怪獣の花唄 (괴수의 꽃노래)' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: '怪獣の花唄 순서 이동' })).toHaveAttribute('data-vaul-no-drag');
    expect(screen.getByRole('button', { name: '踊り子 순서 이동' })).toHaveClass('w-12');

    await userEvent.click(screen.getByRole('button', { name: '재생목록 보기' }));
    expect(screen.getByRole('button', { name: '테스트 목록 재생목록 열기' })).toHaveAttribute('aria-current', 'true');
    await waitFor(() => expect(screen.getByRole('button', { name: '곡 목록 닫기' })).toHaveFocus());
    await userEvent.click(screen.getByRole('button', { name: '테스트 목록 재생목록 열기' }));
    await userEvent.click(screen.getByRole('button', { name: '踊り子 (오도리코)' }));

    expect(onSelect).toHaveBeenCalledWith('test', songB);
  });

  it('reports the reordered library after a drop', async () => {
    const onLibraryChange = vi.fn();
    render(
      <SongDrawer
        library={library}
        currentPlaylistId="test"
        current={songA}
        onSelect={() => {}}
        onLibraryChange={onLibraryChange}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /곡 목록 열기/ }));
    await userEvent.click(await screen.findByRole('button', { name: '테스트 드롭' }));

    expect(onLibraryChange).toHaveBeenCalledWith(
      expect.objectContaining({
        playlists: [expect.objectContaining({ songSlugs: ['b', 'a'] })],
      })
    );
    await waitFor(() => expect(screen.getByRole('button', { name: '怪獣の花唄 순서 이동' })).toHaveFocus());
  });

  it('creates a playlist and adds a validated YouTube song', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
    const user = userEvent.setup();
    render(<SongDrawerHarness />);

    await user.click(screen.getByRole('button', { name: /곡 목록 열기/ }));
    await user.click(screen.getByRole('button', { name: '재생목록 보기' }));
    await user.click(screen.getByRole('button', { name: '재생목록 추가' }));
    await user.click(screen.getByRole('button', { name: '재생목록 만들기' }));
    expect(screen.getByRole('alert')).toHaveTextContent('재생목록 이름');

    await user.type(screen.getByLabelText('재생목록 이름'), 'Fujii Kaze');
    await user.click(screen.getByRole('button', { name: '재생목록 만들기' }));
    expect(screen.getByText('아직 곡이 없습니다')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Fujii Kaze에 곡 추가' }));
    await user.type(screen.getByLabelText('YouTube 영상 주소'), 'https://example.com/video');
    await user.type(screen.getByLabelText('원어 제목'), 'きらり');
    await user.type(screen.getByLabelText('한국어 표기'), '키라리');
    await user.click(screen.getByRole('button', { name: '추가하고 열기' }));
    expect(screen.getByRole('alert')).toHaveTextContent('YouTube 영상 주소');

    await user.clear(screen.getByLabelText('YouTube 영상 주소'));
    await user.type(screen.getByLabelText('YouTube 영상 주소'), 'https://youtu.be/dQw4w9WgXcQ');
    await user.click(screen.getByRole('button', { name: '추가하고 열기' }));
    expect(screen.getByRole('button', { name: /きらり.*곡 목록 열기/ })).toBeInTheDocument();
  });

  it('edits and removes a song, then renames and deletes its playlist', async () => {
    const withPlaylist = addPlaylist(library, 'fujii-kaze', 'Fujii Kaze');
    const saved = saveSongToPlaylist(withPlaylist, 'fujii-kaze', 'https://youtu.be/dQw4w9WgXcQ', {
      titleJa: 'きらり',
      titleKo: '키라리',
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true);
    const user = userEvent.setup();
    render(
      <SongDrawerHarness
        initialLibrary={saved.library}
        initialPlaylistId="fujii-kaze"
        initialSongSlug={saved.song.slug}
      />
    );

    await user.click(screen.getByRole('button', { name: /곡 목록 열기/ }));
    await user.click(screen.getByRole('button', { name: 'きらり 곡 정보 수정' }));
    await user.clear(screen.getByLabelText('원어 제목'));
    await user.type(screen.getByLabelText('원어 제목'), '満ちてゆく');
    await user.clear(screen.getByLabelText('한국어 표기'));
    await user.type(screen.getByLabelText('한국어 표기'), '미치테유쿠');
    await user.click(screen.getByRole('button', { name: '곡 정보 저장' }));
    expect(screen.getByRole('button', { name: '満ちてゆく (미치테유쿠)' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '満ちてゆく 곡 정보 수정' }));
    await user.click(screen.getByRole('button', { name: '이 재생목록에서 제거' }));
    expect(screen.getByLabelText('원어 제목')).toHaveValue('満ちてゆく');
    await user.click(screen.getByRole('button', { name: '이 재생목록에서 제거' }));
    expect(screen.getByText('아직 곡이 없습니다')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '재생목록 보기' }));
    await user.click(screen.getByRole('button', { name: 'Fujii Kaze 재생목록 수정' }));
    await user.clear(screen.getByLabelText('재생목록 이름'));
    await user.click(screen.getByRole('button', { name: '이름 저장' }));
    expect(screen.getByRole('alert')).toHaveTextContent('재생목록 이름');
    await user.type(screen.getByLabelText('재생목록 이름'), '후지이 카제');
    await user.click(screen.getByRole('button', { name: '이름 저장' }));

    await user.click(screen.getByRole('button', { name: '후지이 카제 재생목록 수정' }));
    await user.click(screen.getByRole('button', { name: '재생목록 삭제' }));
    expect(screen.queryByRole('button', { name: '후지이 카제 재생목록 열기' })).not.toBeInTheDocument();
    expect(confirm).toHaveBeenCalledTimes(3);
  });

  it('explains why the last playable song and playlist cannot be removed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(
      <SongDrawerHarness
        initialLibrary={{
          schemaVersion: 2,
          songs: [songA],
          playlists: [{ id: 'only', name: '마지막 목록', songSlugs: ['a'] }],
        }}
        initialPlaylistId="only"
      />
    );

    await user.click(screen.getByRole('button', { name: /곡 목록 열기/ }));
    await user.click(screen.getByRole('button', { name: '怪獣の花唄 곡 정보 수정' }));
    await user.click(screen.getByRole('button', { name: '이 재생목록에서 제거' }));
    expect(screen.getByRole('alert')).toHaveTextContent('재생할 곡이 하나 이상');

    await user.click(screen.getByRole('button', { name: '마지막 목록 곡 목록으로 돌아가기' }));
    await user.click(screen.getByRole('button', { name: '재생목록 보기' }));
    await user.click(screen.getByRole('button', { name: '마지막 목록 재생목록 수정' }));
    await user.click(screen.getByRole('button', { name: '재생목록 삭제' }));
    expect(screen.getByRole('alert')).toHaveTextContent('재생할 곡이 하나 이상');
  });
});
