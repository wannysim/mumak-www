import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PostTags } from '../ui/post-tags';

const mockPush = jest.fn();

// Mock next-intl useRouter
jest.mock('@/src/shared/config/i18n', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('PostTags', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

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

  it('navigates to tag page when tag is clicked', async () => {
    const user = userEvent.setup();
    render(<PostTags tags={['thought']} />);

    await user.click(screen.getByText('#thought'));

    expect(mockPush).toHaveBeenCalledWith('/blog/tags/thought');
  });

  it('URL encodes tag names', async () => {
    const user = userEvent.setup();
    render(<PostTags tags={['c++']} />);

    await user.click(screen.getByText('#c++'));

    expect(mockPush).toHaveBeenCalledWith(`/blog/tags/${encodeURIComponent('c++')}`);
  });

  it('stops event propagation on click', async () => {
    const user = userEvent.setup();
    const parentClickHandler = jest.fn();

    render(
      <div onClick={parentClickHandler}>
        <PostTags tags={['thought']} />
      </div>
    );

    await user.click(screen.getByText('#thought'));

    expect(parentClickHandler).not.toHaveBeenCalled();
  });

  it('prevents default event on click', async () => {
    const user = userEvent.setup();
    render(<PostTags tags={['thought']} />);

    const tag = screen.getByText('#thought');
    await user.click(tag);

    // Navigation should happen via router.push, not default link behavior
    expect(mockPush).toHaveBeenCalled();
  });

  it('renders multiple tags in a flex container', () => {
    const { container } = render(<PostTags tags={['a', 'b', 'c']} />);

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass('flex', 'flex-wrap', 'gap-1');
  });

  it('uses custom basePath for navigation', async () => {
    const user = userEvent.setup();
    render(<PostTags tags={['thought']} basePath="/garden/tags" />);

    await user.click(screen.getByText('#thought'));

    expect(mockPush).toHaveBeenCalledWith('/garden/tags/thought');
  });

  it('defaults to /blog/tags when basePath is not provided', async () => {
    const user = userEvent.setup();
    render(<PostTags tags={['thought']} />);

    await user.click(screen.getByText('#thought'));

    expect(mockPush).toHaveBeenCalledWith('/blog/tags/thought');
  });

  describe('linkable=false', () => {
    it('does not navigate when tag is clicked', async () => {
      const user = userEvent.setup();
      render(<PostTags tags={['thought']} linkable={false} />);

      await user.click(screen.getByText('#thought'));

      expect(mockPush).not.toHaveBeenCalled();
    });

    it('does not apply pointer/hover classes', () => {
      render(<PostTags tags={['thought']} linkable={false} />);

      const badge = screen.getByText('#thought');
      expect(badge.className).not.toMatch(/cursor-pointer/);
      expect(badge.className).not.toMatch(/hover:bg-primary/);
    });

    it('does not stop propagation since no handler is attached', async () => {
      const user = userEvent.setup();
      const parentClickHandler = jest.fn();

      render(
        <div onClick={parentClickHandler}>
          <PostTags tags={['thought']} linkable={false} />
        </div>
      );

      await user.click(screen.getByText('#thought'));

      expect(parentClickHandler).toHaveBeenCalled();
    });
  });
});
