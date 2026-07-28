import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AboutDrawer } from '../components/about-drawer';

describe('AboutDrawer', () => {
  it('stays closed until asked', () => {
    render(<AboutDrawer open={false} onOpenChange={() => {}} />);
    expect(screen.queryByText('이 앱에 대해')).not.toBeInTheDocument();
  });

  it('explains why the app exists', () => {
    render(<AboutDrawer open onOpenChange={() => {}} />);

    expect(screen.getByText('이 앱에 대해')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '왜 만들었나' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '곡을 추가하고 싶다면' })).toBeInTheDocument();
  });

  it('gives a mailto link so people can request songs', () => {
    render(<AboutDrawer open onOpenChange={() => {}} />);

    const link = screen.getByRole('link', { name: /wannysim@gmail\.com/ });
    // 제목이 미리 채워져 있어야 어떤 앱에서 온 메일인지 바로 안다.
    expect(link).toHaveAttribute('href', expect.stringContaining('mailto:wannysim@gmail.com'));
    expect(link.getAttribute('href')).toContain(encodeURIComponent('[노래방] 곡 추가 요청'));
  });

  it('credits the lyrics source with a safe external link', () => {
    render(<AboutDrawer open onOpenChange={() => {}} />);

    const link = screen.getByRole('link', { name: 'lrclib' });
    expect(link).toHaveAttribute('href', 'https://lrclib.net');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
  });
});
