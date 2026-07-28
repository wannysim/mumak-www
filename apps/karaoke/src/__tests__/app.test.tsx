import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../app';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    // 가사 파일은 gitignore 대상이라 테스트에선 항상 404로 취급한다.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response));
  });

  it('renders the first song by default', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('怪獣の花唄');
    expect(screen.getByText(/아직 가사가 등록되지 않은/)).toBeInTheDocument();
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

  it('wraps to the last song when stepping back from the first', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: '이전 곡' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('タイムパラドックス');
  });
});
