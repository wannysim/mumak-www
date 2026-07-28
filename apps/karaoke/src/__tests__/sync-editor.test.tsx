import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SyncEditor } from '../components/sync-editor';

describe('SyncEditor', () => {
  const writeText = vi.fn();

  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  });

  it('stamps lines with the current time and copies LyricLine JSON', async () => {
    render(<SyncEditor time={12.34} />);
    await userEvent.click(screen.getByRole('button', { name: '싱크 편집 모드' }));

    const textarea = await screen.findByRole('textbox');
    await userEvent.type(textarea, '君を握った | 키미오 니깃타 | 너를 붙잡았어{enter}二行目');

    await userEvent.click(screen.getByRole('button', { name: /지금!/ }));
    await userEvent.click(screen.getByRole('button', { name: /지금!/ }));
    expect(screen.getByText('모든 줄 완료!')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'JSON 복사' }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(writeText.mock.calls[0]?.[0]))).toEqual([
      { time: 12.3, jp: '君を握った', pron: '키미오 니깃타', ko: '너를 붙잡았어' },
      { time: 12.3, jp: '二行目', pron: '', ko: '' },
    ]);
  });

  it('undoes the last stamp', async () => {
    render(<SyncEditor time={5} />);
    await userEvent.click(screen.getByRole('button', { name: '싱크 편집 모드' }));
    await userEvent.type(await screen.findByRole('textbox'), 'line1{enter}line2');

    await userEvent.click(screen.getByRole('button', { name: /지금!/ }));
    expect(screen.getByText(/1\/2/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '마지막 스탬프 취소' }));
    expect(screen.getByText(/0\/2/)).toBeInTheDocument();
  });
});
