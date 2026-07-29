import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App, { KARAOKE_GUIDE_KEY, PRIVACY_CONSENT_KEY } from '../app';
import {
  ACTIVE_PLAYLIST_KEY,
  addPlaylist,
  createDefaultSongLibrary,
  saveSongToPlaylist,
  SONG_LIBRARY_KEY,
} from '../lib/song-library';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(PRIVACY_CONSENT_KEY, 'true');
    localStorage.setItem(KARAOKE_GUIDE_KEY, 'true');
  });

  it('requires privacy consent before loading the karaoke', async () => {
    localStorage.removeItem(PRIVACY_CONSENT_KEY);
    render(<App />);

    expect(screen.getByRole('heading', { name: '재생 전 확인' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '가사 편집 열기' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '동의하고 시작' }));
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('怪獣の花唄');
    expect(localStorage.getItem(PRIVACY_CONSENT_KEY)).toBe('true');
  });

  it('renders the first song by default', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('怪獣の花唄');
    expect(await screen.findByText('가사를 불러오세요')).toBeInTheDocument();
  });

  it('offers the browser install prompt from the footer', async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event('beforeinstallprompt'), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    });
    localStorage.removeItem(PRIVACY_CONSENT_KEY);
    render(<App />);

    act(() => window.dispatchEvent(event));
    await userEvent.click(screen.getByRole('button', { name: '동의하고 시작' }));
    await userEvent.click(screen.getByRole('button', { name: '앱 설치' }));

    expect(prompt).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: '앱 설치' })).not.toBeInTheDocument();
  });

  it('restores the last selected song from localStorage', async () => {
    localStorage.setItem('karaoke:song', '"odoriko"');
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('踊り子');
  });

  it('falls back to the first song for an unknown stored slug', async () => {
    localStorage.setItem('karaoke:song', '"deleted-song"');
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('怪獣の花唄');
  });

  it('steps to the next and previous song from the header', async () => {
    render(<App />);
    const heading = screen.getByRole('heading', { level: 1 });

    await userEvent.click(screen.getByRole('button', { name: '다음 곡' }));
    expect(heading).toHaveTextContent('踊り子');

    await userEvent.click(screen.getByRole('button', { name: '이전 곡' }));
    expect(heading).toHaveTextContent('怪獣の花唄');
  });

  it('uses the saved song order for the header position and navigation', async () => {
    const library = createDefaultSongLibrary();
    library.playlists[0]!.songSlugs = [
      'odoriko',
      'kaiju-no-hanauta',
      ...library.playlists[0]!.songSlugs.filter(slug => slug !== 'odoriko' && slug !== 'kaiju-no-hanauta'),
    ];
    localStorage.setItem(SONG_LIBRARY_KEY, JSON.stringify(library));
    render(<App />);

    expect(await screen.findByText('02 / 09')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '다음 곡' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('東京フラッシュ');
  });

  it('wraps to the last song when stepping back from the first', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: '이전 곡' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('タイムパラドックス');
  });

  it('navigates only inside the active user playlist', async () => {
    const withPlaylist = addPlaylist(createDefaultSongLibrary(), 'custom', '내 목록');
    const first = saveSongToPlaylist(withPlaylist, 'custom', 'https://youtu.be/dQw4w9WgXcQ', {
      titleJa: '첫 곡',
      titleKo: '첫 곡',
    });
    const second = saveSongToPlaylist(first.library, 'custom', 'https://youtu.be/9bZkp7q19f0', {
      titleJa: '둘째 곡',
      titleKo: '둘째 곡',
    });
    localStorage.setItem(SONG_LIBRARY_KEY, JSON.stringify(second.library));
    localStorage.setItem(ACTIVE_PLAYLIST_KEY, JSON.stringify('custom'));
    localStorage.setItem('karaoke:song', JSON.stringify(first.song.slug));
    render(<App />);

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('첫 곡');
    await userEvent.click(screen.getByRole('button', { name: '다음 곡' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('둘째 곡');
    await userEvent.click(screen.getByRole('button', { name: '다음 곡' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('첫 곡');
  });

  it('switches the active playlist and song from the drawer', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /곡 목록 열기/ }));
    await userEvent.click(screen.getByRole('button', { name: '재생목록 보기' }));
    await userEvent.click(screen.getByRole('button', { name: 'Fujii Kaze 재생목록 열기' }));
    await userEvent.click(screen.getByRole('button', { name: 'きらり (키라리)' }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('きらり');
    expect(localStorage.getItem(ACTIVE_PLAYLIST_KEY)).toBe(JSON.stringify('fujii-kaze'));
  });
});
