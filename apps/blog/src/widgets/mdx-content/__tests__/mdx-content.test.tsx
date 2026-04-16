import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import { MDXContent, MDXContentSkeleton } from '../ui/mdx-content';

const mockMDXRemote = jest.fn(({ source }: { source: string }) => <div data-testid="mdx-remote">{source}</div>);

jest.mock('next-mdx-remote-client/rsc', () => ({
  MDXRemote: (props: { source: string }) => mockMDXRemote(props),
}));

jest.mock('@mumak/ui/components/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => <div data-testid="skeleton" className={className} />,
}));

describe('MDXContent', () => {
  beforeEach(() => {
    mockMDXRemote.mockClear();
  });

  it('passes the source string to MDXRemote', () => {
    render(<MDXContent source="# Hello" />);

    expect(screen.getByTestId('mdx-remote')).toHaveTextContent('# Hello');
    expect(mockMDXRemote).toHaveBeenCalledWith(
      expect.objectContaining({ source: '# Hello', components: undefined, options: undefined })
    );
  });

  it('forwards components and options to MDXRemote', () => {
    const components = { h1: () => <h1 data-testid="custom-h1" /> };
    const options = { parseFrontmatter: true };

    render(<MDXContent source="content" components={components} options={options} />);

    expect(mockMDXRemote).toHaveBeenCalledWith(expect.objectContaining({ source: 'content', components, options }));
  });
});

describe('MDXContentSkeleton', () => {
  it('renders multiple skeleton placeholders', () => {
    render(<MDXContentSkeleton />);

    // 6개 텍스트 line + 1개 heading + 1개 sub-heading + 5개 paragraph + 1개 image block = 다양한 placeholder
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(5);
  });

  it('includes a tall image-like skeleton block', () => {
    render(<MDXContentSkeleton />);

    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.some(el => el.className.includes('h-48'))).toBe(true);
  });
});
