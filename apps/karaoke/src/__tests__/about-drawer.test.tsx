import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AboutDrawer } from '../components/about-drawer';

const lyricsProps = {
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
    expect(screen.getByRole('heading', { name: '왜 만들었나' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '내 가사' })).toBeInTheDocument();
  });

  it('gives a mailto link for questions', async () => {
    render(<AboutDrawer open onOpenChange={() => {}} {...lyricsProps} />);
    await screen.findByText('0/2곡');

    const link = screen.getByRole('link', { name: /wannysim@gmail\.com/ });
    expect(link).toHaveAttribute('href', expect.stringContaining('mailto:wannysim@gmail.com'));
    expect(link.getAttribute('href')).toContain(encodeURIComponent('[노래방] 문의'));
  });

  it('states the local lyrics boundary without hiding the YouTube integration', async () => {
    render(<AboutDrawer open onOpenChange={() => {}} {...lyricsProps} />);
    await screen.findByText('0/2곡');

    expect(screen.getByText(/별도 서버에 업로드하지 않고 이 브라우저의 IndexedDB에 저장/)).toBeInTheDocument();
    expect(screen.getByText(/별도 서버나 운영자에게 업로드하지 않습니다/)).toBeInTheDocument();
    expect(screen.getByText(/YouTube의 iframe API가 사용됩니다/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '가사 파일 불러오기' })).toBeInTheDocument();
  });
});
