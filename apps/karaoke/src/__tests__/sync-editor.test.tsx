import { fireEvent, render, screen } from '@testing-library/react';
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

async function prepare(text: string) {
  await userEvent.click(screen.getByRole('button', { name: '가사 편집 열기' }));
  await userEvent.click(await screen.findByRole('button', { name: '이미 JSON·LRC가 있어요' }));
  fireEvent.change(await screen.findByLabelText('JSON · LRC 데이터'), {
    target: { value: text.replaceAll('{enter}', '\n') },
  });
  await userEvent.click(screen.getByRole('button', { name: '데이터 적용' }));
}

describe('SyncEditor', () => {
  const writeText = vi.fn();
  const execCommand = vi.fn();

  beforeEach(() => {
    storage.listStoredLyrics.mockReset();
    storage.listStoredLyrics.mockResolvedValue([]);
    storage.saveStoredLyrics.mockReset();
    storage.saveStoredLyrics.mockResolvedValue(undefined);
    storage.withLyricsLibraryWriteLock.mockClear();
    writeText.mockReset();
    execCommand.mockReset();
    execCommand.mockReturnValue(false);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
  });

  it('edits separated lyric fields, stamps lines, and saves them to the device library', async () => {
    const { rerender } = render(<SyncEditor time={12.34} songSlug="odoriko" />);
    await prepare('練習の一行 | 잘못된 발음 | 연습용 한 줄{enter}二行目');

    const pronunciation = screen.getByLabelText('한글 발음');
    fireEvent.change(pronunciation, { target: { value: '렌슈노 이치교' } });

    await userEvent.click(screen.getByRole('button', { name: /지금 이 줄 시작/ }));
    rerender(<SyncEditor time={13.45} songSlug="odoriko" />);
    await userEvent.click(screen.getByRole('button', { name: /지금 이 줄 시작/ }));
    expect(screen.getByText('2/2줄의 시점을 찍었습니다.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '이 기기에 저장' }));
    expect(storage.saveStoredLyrics).toHaveBeenCalledWith('odoriko', [
      { time: 12.3, jp: '練習の一行', pron: '렌슈노 이치교', ko: '연습용 한 줄' },
      { time: 13.5, jp: '二行目', pron: '', ko: '' },
    ]);
    expect(await screen.findByText('이 기기에 저장했습니다.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'JSON 백업 복사' }));
    expect(JSON.parse(String(writeText.mock.calls.at(-1)?.[0]))).toEqual({
      slug: 'odoriko',
      lyrics: [
        { time: 12.3, jp: '練習の一行', pron: '렌슈노 이치교', ko: '연습용 한 줄' },
        { time: 13.5, jp: '二行目', pron: '', ko: '' },
      ],
    });
  });

  it('copies an AI prompt that preserves user-provided lyrics and the paste format', async () => {
    render(<SyncEditor time={0} songSlug="odoriko" songTitle="踊り子" />);
    await userEvent.click(screen.getByRole('button', { name: '가사 편집 열기' }));
    fireEvent.change(await screen.findByLabelText('일본어 원문'), {
      target: { value: '一行目\n二行目' },
    });
    await userEvent.click(await screen.findByRole('button', { name: '외부 AI 요청문 복사 (선택)' }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"time": null'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('확인 가능한 시간 근거가 없으면 time은 null'));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('타임코드를 추측하거나 가사 길이로 균등 배분하지 않습니다')
    );
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('곡 제목(참고용): 踊り子'));
    const prompt = String(writeText.mock.calls[0]?.[0]);
    expect(prompt.indexOf('곡 제목(참고용)')).toBeLessThan(prompt.indexOf('변환할 일본어 가사:'));
    expect(prompt).toContain('변환할 일본어 가사:\n一行目\n二行目');
  });

  it('loads AI-generated timestamped JSON ready to save without manual stamping', async () => {
    render(<SyncEditor time={0} songSlug="odoriko" />);
    await prepare(
      JSON.stringify([
        { time: 12.3, jp: '一行目', pron: '이치교메', ko: '첫 줄' },
        { time: 18.7, jp: '二行目', pron: '니교메', ko: '두 번째 줄' },
      ])
    );

    expect(screen.getByText('2/2줄의 시점을 찍었습니다.')).toBeInTheDocument();
    expect(screen.getByLabelText('시작 시간 (초)')).toHaveValue(12.3);

    await userEvent.click(screen.getByRole('button', { name: '이 기기에 저장' }));
    expect(storage.saveStoredLyrics).toHaveBeenCalledWith('odoriko', [
      { time: 12.3, jp: '一行目', pron: '이치교메', ko: '첫 줄' },
      { time: 18.7, jp: '二行目', pron: '니교메', ko: '두 번째 줄' },
    ]);
  });

  it('loads LRC timestamps without an AI step', async () => {
    render(<SyncEditor time={0} songSlug="odoriko" />);
    await prepare('[ar:Artist]{enter}[ti:Song]{enter}[offset:+500]{enter}[00:12.30]一行目{enter}[00:18.70]二行目');

    expect(screen.getByText('2/2줄의 시점을 찍었습니다.')).toBeInTheDocument();
    expect(screen.getByLabelText('시작 시간 (초)')).toHaveValue(12.8);
    expect(screen.getByLabelText('일본어')).toHaveValue('一行目');
  });

  it('loads timestamped pipe lines while keeping the old three-column format', async () => {
    render(<SyncEditor time={0} songSlug="odoriko" />);
    await prepare('00:12.3 | 一行目 | 이치교메 | 첫 줄{enter}二行目 | 니교메 | 두 번째 줄');

    expect(screen.getByLabelText('시작 시간 (초)')).toHaveValue(null);
    await userEvent.click(screen.getByRole('button', { name: '이전' }));
    expect(screen.getByLabelText('시작 시간 (초)')).toHaveValue(12.3);
  });

  it('accepts AI results with null times for quick manual stamping', async () => {
    render(<SyncEditor time={7.89} songSlug="odoriko" />);
    await prepare(
      JSON.stringify([
        { time: 4, jp: '一行目', pron: '이치교메', ko: '첫 줄' },
        { time: null, jp: '二行目', pron: '니교메', ko: '둘째 줄' },
      ])
    );

    expect(screen.getByLabelText('한글 발음')).toHaveValue('니교메');
    expect(screen.getByLabelText('시작 시간 (초)')).toHaveValue(null);
    await userEvent.click(screen.getByRole('button', { name: /지금 이 줄 시작/ }));
    expect(screen.getByLabelText('시작 시간 (초)')).toHaveValue(7.9);
  });

  it('seeks backward and forward while the editor stays open', async () => {
    const onSeek = vi.fn();
    const onTogglePlay = vi.fn();
    render(<SyncEditor time={12} duration={30} songSlug="odoriko" onSeek={onSeek} onTogglePlay={onTogglePlay} />);
    await prepare('一行目');

    await userEvent.click(screen.getByRole('button', { name: '−5s' }));
    await userEvent.click(screen.getByRole('button', { name: '+5s' }));
    await userEvent.click(screen.getByRole('button', { name: '편집 중 재생' }));

    expect(onSeek).toHaveBeenNthCalledWith(1, 7);
    expect(onSeek).toHaveBeenNthCalledWith(2, 17);
    expect(onTogglePlay).toHaveBeenCalledOnce();
  });

  it('adds, selects, corrects, and removes individual lines', async () => {
    const onSeek = vi.fn();
    render(<SyncEditor time={10} duration={30} songSlug="odoriko" onSeek={onSeek} />);
    await userEvent.click(screen.getByRole('button', { name: '가사 편집 열기' }));
    await userEvent.click(await screen.findByRole('button', { name: '빈 줄부터 직접 만들기' }));

    await userEvent.type(screen.getByLabelText('일본어'), '一行目');
    await userEvent.type(screen.getByLabelText('한국어 번역'), '첫 줄');
    await userEvent.type(screen.getByLabelText('시작 시간 (초)'), '1.2');
    await userEvent.click(screen.getByRole('button', { name: '현재 줄 다음에 추가' }));
    await userEvent.type(screen.getByLabelText('일본어'), '二行目');

    await userEvent.click(screen.getByRole('button', { name: '이전' }));
    expect(screen.getByLabelText('일본어')).toHaveValue('一行目');
    await userEvent.click(screen.getByRole('button', { name: '다음' }));
    await userEvent.click(screen.getByRole('button', { name: /一行目/ }));
    fireEvent.change(screen.getByRole('slider', { name: '편집 재생 위치' }), { target: { value: '15' } });
    await userEvent.click(screen.getByRole('button', { name: '현재 줄 삭제' }));

    expect(onSeek).toHaveBeenCalledWith(15);
    expect(screen.getByText('LINE 01 / 01')).toBeInTheDocument();
    expect(screen.getByLabelText('일본어')).toHaveValue('二行目');
  });

  it('separates source lyrics from AI results and reports a clipboard failure', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    render(<SyncEditor time={0} songSlug="odoriko" />);
    await userEvent.click(screen.getByRole('button', { name: '가사 편집 열기' }));

    expect(await screen.findByRole('button', { name: '외부 AI 요청문 복사 (선택)' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('일본어 원문'), { target: { value: '一行目' } });
    await userEvent.click(screen.getByRole('button', { name: '외부 AI 요청문 복사 (선택)' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('프롬프트를 클립보드에 복사하지 못했습니다.');
    expect(screen.queryByLabelText('JSON · LRC 데이터')).not.toBeInTheDocument();
  });

  it('copies during the click when clipboard permission is denied', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    execCommand.mockReturnValue(true);
    render(<SyncEditor time={0} songSlug="odoriko" />);
    await userEvent.click(screen.getByRole('button', { name: '가사 편집 열기' }));
    fireEvent.change(await screen.findByLabelText('일본어 원문'), { target: { value: '一行目' } });

    await userEvent.click(screen.getByRole('button', { name: '외부 AI 요청문 복사 (선택)' }));

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(await screen.findByLabelText('JSON · LRC 데이터')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('사용 중인 AI에 붙여 넣고');
  });

  it('loads stored lyrics for correcting individual lines', async () => {
    render(
      <SyncEditor
        time={5}
        songSlug="odoriko"
        lyrics={[{ time: 1.2, jp: '踊り子', pron: '오도리코', ko: '춤추는 아이' }]}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: '가사 편집 열기' }));

    expect(await screen.findByLabelText('일본어')).toHaveValue('踊り子');
    expect(screen.getByLabelText('한글 발음')).toHaveValue('오도리코');
    expect(screen.getByLabelText('시작 시간 (초)')).toHaveValue(1.2);
  });

  it('keeps import and editing as separate modes without discarding the current draft', async () => {
    render(
      <SyncEditor
        time={5}
        songSlug="odoriko"
        lyrics={[{ time: 1.2, jp: '踊り子', pron: '오도리코', ko: '춤추는 아이' }]}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: '가사 편집 열기' }));
    await userEvent.click(await screen.findByRole('button', { name: '새 가사로 교체' }));

    expect(screen.getByRole('heading', { name: '새 가사 가져오기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이 원문으로 가사 교체' })).toBeDisabled();
    expect(screen.queryByLabelText('일본어')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '현재 가사로 돌아가기' }));
    expect(screen.getByLabelText('일본어')).toHaveValue('踊り子');
  });

  it('clears an untouched draft when its stored lyrics are deleted elsewhere', async () => {
    const { rerender } = render(
      <SyncEditor
        time={5}
        songSlug="odoriko"
        lyrics={[{ time: 1.2, jp: '踊り子', pron: '오도리코', ko: '춤추는 아이' }]}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: '가사 편집 열기' }));
    expect(await screen.findByLabelText('일본어')).toHaveValue('踊り子');

    rerender(<SyncEditor time={5} songSlug="odoriko" lyrics={[]} />);

    expect(await screen.findByRole('heading', { name: '새 가사 가져오기' })).toBeInTheDocument();
    expect(screen.queryByLabelText('일본어')).not.toBeInTheDocument();
  });

  it('asks before replacing lyrics that are already stored for the song', async () => {
    storage.listStoredLyrics.mockResolvedValue(['odoriko']);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<SyncEditor time={5} songSlug="odoriko" />);
    await prepare('一行目');
    await userEvent.click(screen.getByRole('button', { name: /지금 이 줄 시작/ }));
    await userEvent.click(screen.getByRole('button', { name: '이 기기에 저장' }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('되돌릴 수 없습니다'));
    expect(storage.saveStoredLyrics).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('explains a timestamp error instead of blaming browser storage', async () => {
    render(<SyncEditor time={5} songSlug="odoriko" />);
    await prepare('一行目{enter}二行目');
    await userEvent.click(screen.getByRole('button', { name: /지금 이 줄 시작/ }));
    await userEvent.click(screen.getByRole('button', { name: /지금 이 줄 시작/ }));
    await userEvent.click(screen.getByRole('button', { name: '이 기기에 저장' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('2번째 줄의 시간은 이전 줄보다 커야 합니다.');
    expect(storage.saveStoredLyrics).not.toHaveBeenCalled();
  });
});
