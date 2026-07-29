import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LyricsView } from '../components/lyrics-view';
import { DEFAULT_DISPLAY } from '../lib/display-settings';
import type { LyricLine } from '../lib/lyrics';

const lyrics: LyricLine[] = [
  { time: 10, jp: '練習の一行', pron: '렌슈노 이치교', ko: '연습용 첫 줄' },
  { time: 20, jp: '練習の二行', pron: '렌슈노 니교', ko: '연습용 둘째 줄' },
];

describe('LyricsView', () => {
  it('shows an empty state when there are no lyrics', () => {
    render(
      <LyricsView
        lyrics={[]}
        time={0}
        display={DEFAULT_DISPLAY}
        emptyAction={<button type="button">가사 파일 불러오기</button>}
        onSeek={() => {}}
      />
    );
    expect(screen.getByText('가사를 불러오세요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '가사 파일 불러오기' })).toBeInTheDocument();
    expect(screen.getByText(/이 기기에만 저장/)).toBeInTheDocument();
    expect(screen.queryByText(/IndexedDB/)).not.toBeInTheDocument();
  });

  it('does not show the import invitation while the local library is loading', () => {
    render(<LyricsView lyrics={[]} status="loading" time={0} display={DEFAULT_DISPLAY} onSeek={() => {}} />);
    expect(screen.getByText(/내 가사 확인 중/)).toBeInTheDocument();
    expect(screen.queryByText('가사를 불러오세요')).not.toBeInTheDocument();
  });

  it('keeps recovery import available and explains a stored-record error', () => {
    render(
      <LyricsView
        lyrics={[]}
        status="error"
        errorMessage="저장된 가사 형식의 버전을 읽을 수 없습니다."
        time={0}
        display={DEFAULT_DISPLAY}
        emptyAction={<button type="button">가사 파일 불러오기</button>}
        onSeek={() => {}}
      />
    );

    expect(screen.getByText(/가사 형식의 버전을 읽을 수 없습니다/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '가사 파일 불러오기' })).toBeInTheDocument();
  });

  it('renders jp, pron, and ko for each line', () => {
    render(<LyricsView lyrics={lyrics} time={0} display={DEFAULT_DISPLAY} onSeek={() => {}} />);
    expect(screen.getByText('練習の一行')).toBeInTheDocument();
    expect(screen.getByText('렌슈노 이치교')).toBeInTheDocument();
    expect(screen.getByText('연습용 첫 줄')).toBeInTheDocument();
  });

  it('hides rows that are toggled off', () => {
    render(<LyricsView lyrics={lyrics} time={0} display={{ jp: true, pron: false, ko: false }} onSeek={() => {}} />);
    expect(screen.getByText('練習の一行')).toBeInTheDocument();
    expect(screen.queryByText('렌슈노 이치교')).not.toBeInTheDocument();
    expect(screen.queryByText('연습용 첫 줄')).not.toBeInTheDocument();
  });

  it('marks the current lyric and shows its cue time', () => {
    render(<LyricsView lyrics={lyrics} time={10} display={DEFAULT_DISPLAY} onSeek={() => {}} />);

    const activeLine = screen.getByRole('button', { name: /練習の一行/ });
    const nextLine = screen.getByRole('button', { name: /練習の二行/ });

    expect(activeLine).toHaveAttribute('aria-current', 'true');
    expect(within(activeLine).getByText('00:10.0')).toBeInTheDocument();
    expect(nextLine).not.toHaveAttribute('aria-current');
  });

  it('seeks to the tapped line', async () => {
    const onSeek = vi.fn();
    render(<LyricsView lyrics={lyrics} time={0} display={DEFAULT_DISPLAY} onSeek={onSeek} />);
    await userEvent.click(screen.getByText('練習の二行'));
    expect(onSeek).toHaveBeenCalledWith(20);
  });

  it('centers the upcoming first line before its cue starts', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    render(<LyricsView lyrics={lyrics} time={0} display={DEFAULT_DISPLAY} onSeek={() => {}} />);

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('re-centers the first line when its cue activates after pre-roll', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const { rerender } = render(<LyricsView lyrics={lyrics} time={0} display={DEFAULT_DISPLAY} onSeek={() => {}} />);
    rerender(<LyricsView lyrics={lyrics} time={10} display={DEFAULT_DISPLAY} onSeek={() => {}} />);

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
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
