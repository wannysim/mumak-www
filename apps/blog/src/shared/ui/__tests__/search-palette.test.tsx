import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileText } from 'lucide-react';

import { SearchPalette, type SearchPaletteGroup } from '../search-palette';

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

jest.mock('@mumak/ui/components/command', () => ({
  Command: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandDialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) => (
    <div data-testid="command-dialog" data-open={open ? 'true' : 'false'}>
      {open ? children : null}
    </div>
  ),
  CommandInput: (props: React.ComponentProps<'input'>) => <input data-testid="command-input" {...props} />,
  CommandList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: React.ReactNode }) => <div data-testid="command-empty">{children}</div>,
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

const groups: SearchPaletteGroup[] = [
  {
    key: 'essay',
    label: 'Essay',
    items: [
      {
        id: 'first-thoughts',
        label: 'First Thoughts',
        href: '/blog/essay/first-thoughts',
        searchKeywords: 'reflection journaling',
        icon: FileText,
        hint: 'Essay',
      },
    ],
  },
  {
    key: 'notes',
    label: 'Notes',
    items: [{ id: 'short-memo', label: 'Short Memo', href: '/blog/notes/short-memo' }],
  },
];

describe('SearchPalette', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders nothing visible when closed', () => {
    render(
      <SearchPalette
        open={false}
        onOpenChange={jest.fn()}
        groups={groups}
        placeholder="Search"
        emptyText="No results"
        title="Search"
        description="Find something"
      />
    );

    expect(screen.getByTestId('command-dialog')).toHaveAttribute('data-open', 'false');
    expect(screen.queryByTestId('command-item')).not.toBeInTheDocument();
  });

  it('renders all items grouped by their group label when open', () => {
    render(
      <SearchPalette
        open
        onOpenChange={jest.fn()}
        groups={groups}
        placeholder="Search"
        emptyText="No results"
        title="Search"
        description="Find something"
      />
    );

    const headings = screen.getAllByTestId('command-group-heading').map(node => node.textContent);
    expect(headings).toEqual(['Essay', 'Notes']);

    expect(screen.getByText('First Thoughts')).toBeInTheDocument();
    expect(screen.getByText('Short Memo')).toBeInTheDocument();
  });

  it('includes searchKeywords in the cmdk match value', () => {
    render(
      <SearchPalette
        open
        onOpenChange={jest.fn()}
        groups={groups}
        placeholder="Search"
        emptyText="No results"
        title="Search"
        description="Find something"
      />
    );

    const item = screen.getAllByTestId('command-item')[0]!;
    expect(item.getAttribute('data-value')).toContain('reflection journaling');
  });

  it('renders the optional hint as right-aligned text', () => {
    render(
      <SearchPalette
        open
        onOpenChange={jest.fn()}
        groups={groups}
        placeholder="Search"
        emptyText="No results"
        title="Search"
        description="Find something"
      />
    );

    const hints = screen.getAllByText('Essay');
    expect(hints.length).toBeGreaterThan(1);
  });

  it('navigates and closes the dialog when an item is selected', async () => {
    const user = userEvent.setup();
    const onOpenChange = jest.fn();
    render(
      <SearchPalette
        open
        onOpenChange={onOpenChange}
        groups={groups}
        placeholder="Search"
        emptyText="No results"
        title="Search"
        description="Find something"
      />
    );

    const items = screen.getAllByTestId('command-item');
    await user.click(items[0]!);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockPush).toHaveBeenCalledWith('/blog/essay/first-thoughts');
  });

  it('invokes onSelect callback in addition to navigating', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    const onOpenChange = jest.fn();
    render(
      <SearchPalette
        open
        onOpenChange={onOpenChange}
        groups={groups}
        placeholder="Search"
        emptyText="No results"
        title="Search"
        description="Find something"
        onSelect={onSelect}
      />
    );

    await user.click(screen.getAllByTestId('command-item')[1]!);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]![0]).toMatchObject({ id: 'short-memo' });
    expect(mockPush).toHaveBeenCalledWith('/blog/notes/short-memo');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
