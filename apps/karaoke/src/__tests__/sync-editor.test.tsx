import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SyncEditor } from '../components/sync-editor';

const storage = vi.hoisted(() => ({
  listStoredLyrics: vi.fn(),
  saveStoredLyrics: vi.fn(),
  withLyricsLibraryWriteLock: vi.fn((operation: () => Promise<unknown>) => operation()),
}));

vi.mock('@/lib/lyrics-storage', async importOriginal => {
  const actual = await importOriginal<typeof import('../lib/lyrics-storage')>();
  return { ...actual, ...storage };
});

describe('SyncEditor', () => {
  const writeText = vi.fn();

  beforeEach(() => {
    storage.listStoredLyrics.mockReset();
    storage.listStoredLyrics.mockResolvedValue([]);
    storage.saveStoredLyrics.mockReset();
    storage.saveStoredLyrics.mockResolvedValue(undefined);
    storage.withLyricsLibraryWriteLock.mockClear();
    writeText.mockReset();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  });

  it('stamps lines and saves them only to the device library', async () => {
    const { rerender } = render(<SyncEditor time={12.34} songSlug="odoriko" />);
    await userEvent.click(screen.getByRole('button', { name: '싱크 편집 모드' }));

    const textarea = await screen.findByRole('textbox');
    await userEvent.type(textarea, '練習の一行 | 렌슈노 이치교 | 연습용 한 줄{enter}二行目');

    await userEvent.click(screen.getByRole('button', { name: /지금!/ }));
    rerender(<SyncEditor time={13.45} songSlug="odoriko" />);
    await userEvent.click(screen.getByRole('button', { name: /지금!/ }));
    expect(screen.getByText('모든 줄 완료!')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '이 기기에 저장' }));
    expect(storage.saveStoredLyrics).toHaveBeenCalledWith('odoriko', [
      { time: 12.3, jp: '練習の一行', pron: '렌슈노 이치교', ko: '연습용 한 줄' },
      { time: 13.5, jp: '二行目', pron: '', ko: '' },
    ]);
    expect(await screen.findByText('이 기기에 저장했습니다.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'JSON 백업 복사' }));
    expect(JSON.parse(String(writeText.mock.calls[0]?.[0]))).toEqual({
      slug: 'odoriko',
      lyrics: [
        { time: 12.3, jp: '練習の一行', pron: '렌슈노 이치교', ko: '연습용 한 줄' },
        { time: 13.5, jp: '二行目', pron: '', ko: '' },
      ],
    });

    await userEvent.click(screen.getByRole('button', { name: '마지막 스탬프 취소' }));
    expect(screen.queryByText('이 기기에 저장했습니다.')).not.toBeInTheDocument();
    expect(screen.queryByText('JSON을 클립보드에 복사했습니다.')).not.toBeInTheDocument();
  });

  it('undoes the last stamp', async () => {
    render(<SyncEditor time={5} songSlug="odoriko" />);
    await userEvent.click(screen.getByRole('button', { name: '싱크 편집 모드' }));
    await userEvent.type(await screen.findByRole('textbox'), 'line1{enter}line2');

    await userEvent.click(screen.getByRole('button', { name: /지금!/ }));
    expect(screen.getByText(/1\/2/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '마지막 스탬프 취소' }));
    expect(screen.getByText(/0\/2/)).toBeInTheDocument();
  });

  it('asks before replacing lyrics that are already stored for the song', async () => {
    storage.listStoredLyrics.mockResolvedValue(['odoriko']);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<SyncEditor time={5} songSlug="odoriko" />);
    await userEvent.click(screen.getByRole('button', { name: '싱크 편집 모드' }));
    await userEvent.type(await screen.findByRole('textbox'), '一行目');
    await userEvent.click(screen.getByRole('button', { name: /지금!/ }));
    await userEvent.click(screen.getByRole('button', { name: '이 기기에 저장' }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('되돌릴 수 없습니다'));
    expect(storage.saveStoredLyrics).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('explains a timestamp error instead of blaming browser storage', async () => {
    render(<SyncEditor time={5} songSlug="odoriko" />);
    await userEvent.click(screen.getByRole('button', { name: '싱크 편집 모드' }));
    await userEvent.type(await screen.findByRole('textbox'), '一行目{enter}二行目');
    await userEvent.click(screen.getByRole('button', { name: /지금!/ }));
    await userEvent.click(screen.getByRole('button', { name: /지금!/ }));
    await userEvent.click(screen.getByRole('button', { name: '이 기기에 저장' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('2번째 줄의 시간은 이전 줄보다 커야 합니다.');
    expect(storage.saveStoredLyrics).not.toHaveBeenCalled();
  });
});
