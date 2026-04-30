import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { BlogSearch, type BlogSearchPost } from '../ui/blog-search';

import '@testing-library/jest-dom';

const mockPush = jest.fn();

jest.mock('@/src/shared/config/i18n', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@mumak/ui/components/command', () => ({
  Command: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandDialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) => (
    <div data-testid="command-dialog" data-open={open ? 'true' : 'false'}>
      {open ? children : null}
    </div>
  ),
  CommandInput: (props: React.ComponentProps<'input'>) => <input data-testid="command-input" {...props} />,
  CommandList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ children, heading }: { children: React.ReactNode; heading?: React.ReactNode }) => (
    <div data-testid="command-group">
      <div data-testid="command-group-heading">{heading}</div>
      {children}
    </div>
  ),
  CommandItem: ({
    children,
    onSelect,
    value,
  }: {
    children: React.ReactNode;
    value?: string;
    onSelect?: (value: string) => void;
  }) => (
    <button type="button" data-testid="command-item" data-value={value} onClick={() => onSelect?.(value ?? '')}>
      {children}
    </button>
  ),
}));

const posts: BlogSearchPost[] = [
  {
    title: 'Hello Essay',
    description: 'My first essay',
    category: 'essay',
    slug: 'hello-essay',
    tags: ['intro', 'thoughts'],
  },
  {
    title: 'Deep Article',
    description: 'A long-form piece',
    category: 'articles',
    slug: 'deep-article',
    tags: ['research'],
  },
  {
    title: 'Quick Note',
    description: 'Short memo',
    category: 'notes',
    slug: 'quick-note',
    tags: [],
  },
  {
    title: 'Another Essay',
    description: 'More thoughts',
    category: 'essay',
    slug: 'another-essay',
    tags: [],
  },
];

const categoryLabels = { essay: 'Essay', articles: 'Articles', notes: 'Notes' };

describe('BlogSearch', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders a search trigger button', () => {
    render(<BlogSearch posts={posts} categoryLabels={categoryLabels} />);

    expect(screen.getByRole('button', { name: /placeholder|aria/i })).toBeInTheDocument();
  });

  it('opens the palette when the trigger is clicked', async () => {
    const user = userEvent.setup();
    render(<BlogSearch posts={posts} categoryLabels={categoryLabels} />);

    expect(screen.getByTestId('command-dialog')).toHaveAttribute('data-open', 'false');

    await user.click(screen.getByRole('button'));

    expect(screen.getByTestId('command-dialog')).toHaveAttribute('data-open', 'true');
  });

  it('opens the palette via the Cmd+K shortcut', async () => {
    const user = userEvent.setup();
    render(<BlogSearch posts={posts} categoryLabels={categoryLabels} />);

    await user.keyboard('{Meta>}k{/Meta}');

    expect(screen.getByTestId('command-dialog')).toHaveAttribute('data-open', 'true');
  });

  it('groups posts by category using the provided labels', async () => {
    const user = userEvent.setup();
    render(<BlogSearch posts={posts} categoryLabels={categoryLabels} />);

    await user.click(screen.getByRole('button'));

    const headings = screen.getAllByTestId('command-group-heading').map(node => node.textContent);
    expect(headings).toEqual(['Essay', 'Articles', 'Notes']);
  });

  it('builds command-item values that include description and tags so fuzzy matching covers them', async () => {
    const user = userEvent.setup();
    render(<BlogSearch posts={posts} categoryLabels={categoryLabels} />);

    await user.click(screen.getByRole('button'));

    const helloEssay = screen.getAllByTestId('command-item').find(item => item.textContent?.includes('Hello Essay'));
    expect(helloEssay).toBeDefined();
    const value = helloEssay!.getAttribute('data-value') ?? '';
    expect(value).toContain('My first essay');
    expect(value).toContain('intro');
    expect(value).toContain('thoughts');
  });

  it('navigates to /blog/{category}/{slug} when a post is selected', async () => {
    const user = userEvent.setup();
    render(<BlogSearch posts={posts} categoryLabels={categoryLabels} />);

    await user.click(screen.getByRole('button'));

    const item = screen.getAllByTestId('command-item').find(node => node.textContent?.includes('Deep Article'));
    expect(item).toBeDefined();
    await user.click(item!);

    expect(mockPush).toHaveBeenCalledWith('/blog/articles/deep-article');
  });
});
