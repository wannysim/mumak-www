import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SongDrawer } from '../components/song-drawer';
import type { Song } from '../songs';

const songA: Song = { slug: 'a', titleJa: '怪獣の花唄', titleKo: '괴수의 꽃노래', videoId: 'x' };
const songB: Song = { slug: 'b', titleJa: '踊り子', titleKo: '오도리코', videoId: 'y' };
const songs = [songA, songB];

describe('SongDrawer', () => {
  it('shows the current song position with a padded total', () => {
    render(<SongDrawer songs={songs} current={songB} onSelect={() => {}} onAbout={() => {}} />);

    expect(screen.getByText('02 / 02')).toBeInTheDocument();
  });

  it('lists songs and selects one', async () => {
    const onSelect = vi.fn();
    render(<SongDrawer songs={songs} current={songA} onSelect={onSelect} onAbout={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: /곡 목록 열기/ }));
    expect(await screen.findByText('곡 선택')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '怪獣の花唄 (괴수의 꽃노래)' })).toHaveAttribute('aria-current', 'true');

    await userEvent.click(screen.getByText('踊り子'));
    expect(onSelect).toHaveBeenCalledWith(songB);
  });

  it('offers a way into the about sheet', async () => {
    const onAbout = vi.fn();
    render(<SongDrawer songs={songs} current={songA} onSelect={() => {}} onAbout={onAbout} />);

    await userEvent.click(screen.getByRole('button', { name: /곡 목록 열기/ }));
    await userEvent.click(await screen.findByRole('button', { name: /이 앱에 대해/ }));

    expect(onAbout).toHaveBeenCalledTimes(1);
  });
});
