import { render, screen } from '@testing-library/react';

import { PostTags } from '../ui/post-tags';

import '@testing-library/jest-dom';

// i18n Link → 실제 <a href>로 렌더해 anchor(=키보드 도달 가능) 여부를 검증한다.
jest.mock('@/src/shared/config/i18n', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe('PostTags', () => {
  it('renders all tags with # prefix', () => {
    render(<PostTags tags={['thought', 'code', 'ai']} />);

    expect(screen.getByText('#thought')).toBeInTheDocument();
    expect(screen.getByText('#code')).toBeInTheDocument();
    expect(screen.getByText('#ai')).toBeInTheDocument();
  });

  it('returns null when tags array is empty', () => {
    const { container } = render(<PostTags tags={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders each linkable tag as a real, keyboard-reachable link to its tag page', () => {
    render(<PostTags tags={['thought']} />);

    // 실제 anchor여야 키보드/스크린리더로 도달·활성화 가능 (이전엔 span+onClick이라 불가능했다)
    const link = screen.getByRole('link', { name: '#thought' });
    expect(link).toHaveAttribute('href', '/blog/tags/thought');
  });

  it('URL-encodes tag names in the link href', () => {
    render(<PostTags tags={['c++']} />);

    expect(screen.getByRole('link', { name: '#c++' })).toHaveAttribute(
      'href',
      `/blog/tags/${encodeURIComponent('c++')}`
    );
  });

  it('uses a custom basePath for the link href', () => {
    render(<PostTags tags={['thought']} basePath="/garden/tags" />);

    expect(screen.getByRole('link', { name: '#thought' })).toHaveAttribute('href', '/garden/tags/thought');
  });

  it('renders multiple tags in a flex container', () => {
    const { container } = render(<PostTags tags={['a', 'b', 'c']} />);

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass('flex', 'flex-wrap', 'gap-1');
  });

  describe('linkable=false', () => {
    it('renders plain badges with no links', () => {
      render(<PostTags tags={['thought']} linkable={false} />);

      expect(screen.getByText('#thought')).toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('does not apply pointer/hover classes to non-linkable badges', () => {
      render(<PostTags tags={['thought']} linkable={false} />);

      const badge = screen.getByText('#thought');
      expect(badge.className).not.toMatch(/cursor-pointer/);
      expect(badge.className).not.toMatch(/hover:bg-primary/);
    });
  });
});
