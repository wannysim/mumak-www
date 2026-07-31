import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AboutDrawer } from '../components/about-drawer';

const lyricsProps = {
  onStartGuide: () => {},
  onResetPlaylists: () => {},
  songSlugs: ['kaiju-no-hanauta', 'odoriko'],
};

describe('AboutDrawer', () => {
  it('stays closed until asked', () => {
    render(<AboutDrawer open={false} onOpenChange={() => {}} {...lyricsProps} />);
    expect(screen.queryByText('이 앱에 대해')).not.toBeInTheDocument();
  });

  it('explains why the app exists', async () => {
    render(<AboutDrawer open onOpenChange={() => {}} {...lyricsProps} />);
    await screen.findByText('0/2곡');

    expect(screen.getByText('이 앱에 대해')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '무엇을 위한 앱인가' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '내 가사' })).toBeInTheDocument();
  });

  it('gives a mailto link for questions', async () => {
    render(<AboutDrawer open onOpenChange={() => {}} {...lyricsProps} />);
    await screen.findByText('0/2곡');

    const link = screen.getByRole('link', { name: /wannysim@gmail\.com/ });
    expect(link).toHaveAttribute('href', expect.stringContaining('mailto:wannysim@gmail.com'));
    expect(link.getAttribute('href')).toContain(encodeURIComponent('[노래방] 문의'));
  });

  it('states the local lyrics, copyright, and external service boundaries', async () => {
    render(<AboutDrawer open onOpenChange={() => {}} {...lyricsProps} />);
    await screen.findByText('0/2곡');

    expect(screen.getByText(/저장 원리 · 가사는 브라우저가 제공하는 기기 내 저장 공간/)).toBeInTheDocument();
    expect(screen.getByText(/운영자 서버 또는 외부 가사 서비스로 전송하지 않습니다/)).toBeInTheDocument();
    expect(screen.getByText(/제휴·후원·승인 관계가 없는 비공식 도구/)).toBeInTheDocument();
    expect(screen.getByText(/적법하게 이용할 수 있는 자료만 불러오고/)).toBeInTheDocument();
    expect(screen.getByText(/YouTube 재생 기능을 이용하면/)).toHaveTextContent('동의한 것으로 봅니다');
    expect(screen.getByRole('link', { name: 'YouTube 이용약관' })).toHaveAttribute(
      'href',
      'https://www.youtube.com/t/terms'
    );
    expect(screen.getByRole('link', { name: 'Google 개인정보처리방침' })).toHaveAttribute(
      'href',
      'https://policies.google.com/privacy'
    );
    expect(screen.getByRole('button', { name: '백업 또는 가사 파일 불러오기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '처음 사용 가이드 다시 보기' })).toBeInTheDocument();
  });

  it('resets playlists only after confirmation', async () => {
    const onResetPlaylists = vi.fn();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<AboutDrawer open onOpenChange={() => {}} {...lyricsProps} onResetPlaylists={onResetPlaylists} />);
    await screen.findByText('0/2곡');

    const reset = screen.getByRole('button', { name: '재생목록 초기화…' });
    expect(reset).toHaveAttribute('data-variant', 'destructive');
    expect(reset).toHaveClass('dark:text-destructive-foreground');
    await userEvent.click(reset);
    expect(onResetPlaylists).not.toHaveBeenCalled();
    await userEvent.click(reset);
    expect(onResetPlaylists).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledTimes(2);
  });
});
