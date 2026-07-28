import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LyricsView } from '../components/lyrics-view';
import { DEFAULT_DISPLAY } from '../lib/display-settings';
import type { LyricLine } from '../lib/lyrics';

const lyrics: LyricLine[] = [
  { time: 10, jp: '君を握った', pron: '키미오 니깃타', ko: '너를 붙잡았어' },
  { time: 20, jp: '夜を数えた', pron: '요루오 카조에타', ko: '밤을 세었어' },
];

describe('LyricsView', () => {
  it('shows an empty state when there are no lyrics', () => {
    render(<LyricsView lyrics={[]} time={0} display={DEFAULT_DISPLAY} onSeek={() => {}} />);
    expect(screen.getByText(/아직 가사가 등록되지 않은/)).toBeInTheDocument();
  });

  it('renders jp, pron, and ko for each line', () => {
    render(<LyricsView lyrics={lyrics} time={0} display={DEFAULT_DISPLAY} onSeek={() => {}} />);
    expect(screen.getByText('君を握った')).toBeInTheDocument();
    expect(screen.getByText('키미오 니깃타')).toBeInTheDocument();
    expect(screen.getByText('너를 붙잡았어')).toBeInTheDocument();
  });

  it('hides rows that are toggled off', () => {
    render(<LyricsView lyrics={lyrics} time={0} display={{ jp: true, pron: false, ko: false }} onSeek={() => {}} />);
    expect(screen.getByText('君を握った')).toBeInTheDocument();
    expect(screen.queryByText('키미오 니깃타')).not.toBeInTheDocument();
    expect(screen.queryByText('너를 붙잡았어')).not.toBeInTheDocument();
  });

  it('seeks to the tapped line', async () => {
    const onSeek = vi.fn();
    render(<LyricsView lyrics={lyrics} time={0} display={DEFAULT_DISPLAY} onSeek={onSeek} />);
    await userEvent.click(screen.getByText('夜を数えた'));
    expect(onSeek).toHaveBeenCalledWith(20);
  });

  it('auto-scrolls to the active line, unless the user scrolled manually', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const { rerender, container } = render(
      <LyricsView lyrics={lyrics} time={10} display={DEFAULT_DISPLAY} onSeek={() => {}} />
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    fireEvent.wheel(container.firstElementChild!);
    rerender(<LyricsView lyrics={lyrics} time={20} display={DEFAULT_DISPLAY} onSeek={() => {}} />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
