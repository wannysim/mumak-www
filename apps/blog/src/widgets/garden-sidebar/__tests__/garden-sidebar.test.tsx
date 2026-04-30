import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GardenSidebar } from '../ui/garden-sidebar';

import '@testing-library/jest-dom';

const mockUsePathname = jest.fn(() => '/garden');
const mockPush = jest.fn();

jest.mock('@/src/shared/config/i18n', () => ({
  Link: ({
    children,
    href,
    onClick,
    className,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: () => void;
    className?: string;
    [key: string]: unknown;
  }) => (
    <a href={href} onClick={onClick} className={className} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => mockUsePathname(),
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

// Mock Sheet to render children directly (avoid radix portal in jsdom).
jest.mock('@mumak/ui/components/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div data-testid="sheet-root">{children}</div>,
  SheetTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div data-testid="sheet-content">{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock CommandDialog/Command primitives — surface `open` via attribute and let
// children render so we can assert search items.
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
    <div>
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
    <button type="button" data-testid="command-item" onClick={() => onSelect?.(value ?? '')}>
      {children}
    </button>
  ),
}));

const categories = [
  {
    key: 'projects',
    label: 'Projects',
    noteCount: 3,
    tree: [
      {
        slug: 'projects/active',
        title: 'Active Project',
        children: [
          { slug: 'projects/active/first', title: 'First Subnote', children: [] },
          { slug: 'projects/active/second', title: 'Second Subnote', children: [] },
        ],
      },
      { slug: 'projects/standalone', title: 'Standalone Project', children: [] },
    ],
  },
  {
    key: 'areas',
    label: 'Areas',
    noteCount: 1,
    tree: [{ slug: 'areas/health', title: 'Health Area', children: [] }],
  },
  {
    key: 'archives',
    label: 'Archives',
    noteCount: 0,
    tree: [],
  },
];

describe('GardenSidebar', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/garden');
    mockPush.mockClear();
  });

  it('renders categories that have notes and hides empty ones', () => {
    render(<GardenSidebar categories={categories} />);

    const navs = screen.getAllByRole('navigation', { name: 'Garden notes' });
    expect(navs.length).toBeGreaterThan(0);

    const nav = navs[0]!;
    expect(within(nav).getByText('Projects')).toBeInTheDocument();
    expect(within(nav).getByText('Areas')).toBeInTheDocument();
    expect(within(nav).queryByText('Archives')).not.toBeInTheDocument();
  });

  it('renders top-level note links from each visible category', () => {
    render(<GardenSidebar categories={categories} />);

    const navs = screen.getAllByRole('navigation', { name: 'Garden notes' });
    const nav = navs[0]!;

    expect(within(nav).getAllByRole('link', { name: 'Active Project' })[0]).toHaveAttribute(
      'href',
      '/garden/projects/active'
    );
    expect(within(nav).getAllByRole('link', { name: 'Standalone Project' })[0]).toHaveAttribute(
      'href',
      '/garden/projects/standalone'
    );
    expect(within(nav).getAllByRole('link', { name: 'Health Area' })[0]).toHaveAttribute(
      'href',
      '/garden/areas/health'
    );
  });

  it('marks the active note with aria-current="page"', () => {
    mockUsePathname.mockReturnValue('/garden/projects/standalone');
    render(<GardenSidebar categories={categories} />);

    const nav = screen.getAllByRole('navigation', { name: 'Garden notes' })[0]!;
    const activeLink = within(nav).getAllByRole('link', { name: 'Standalone Project' })[0]!;
    expect(activeLink).toHaveAttribute('aria-current', 'page');

    const otherLink = within(nav).getAllByRole('link', { name: 'Active Project' })[0]!;
    expect(otherLink).not.toHaveAttribute('aria-current');
  });

  it('auto-expands ancestors of the active note so the active leaf is visible', () => {
    mockUsePathname.mockReturnValue('/garden/projects/active/first');
    render(<GardenSidebar categories={categories} />);

    const nav = screen.getAllByRole('navigation', { name: 'Garden notes' })[0]!;
    expect(within(nav).getByRole('link', { name: 'First Subnote' })).toBeInTheDocument();
  });

  it('keeps non-active branches collapsed by default (children not rendered)', () => {
    render(<GardenSidebar categories={categories} />);

    const nav = screen.getAllByRole('navigation', { name: 'Garden notes' })[0]!;
    expect(within(nav).queryByRole('link', { name: 'First Subnote' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Second Subnote' })).not.toBeInTheDocument();
  });

  it('expands a collapsed branch when its toggle button is clicked', async () => {
    const user = userEvent.setup();
    render(<GardenSidebar categories={categories} />);

    const nav = screen.getAllByRole('navigation', { name: 'Garden notes' })[0]!;
    expect(within(nav).queryByRole('link', { name: 'First Subnote' })).not.toBeInTheDocument();

    const expandButton = within(nav).getAllByRole('button', { name: 'Expand' })[0]!;
    await user.click(expandButton);

    expect(within(nav).getByRole('link', { name: 'First Subnote' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Second Subnote' })).toBeInTheDocument();
  });

  it('opens the search dialog via the Cmd/Ctrl+K shortcut', async () => {
    const user = userEvent.setup();
    render(<GardenSidebar categories={categories} />);

    const dialog = screen.getByTestId('command-dialog');
    expect(dialog).toHaveAttribute('data-open', 'false');

    await user.keyboard('{Meta>}k{/Meta}');

    expect(screen.getByTestId('command-dialog')).toHaveAttribute('data-open', 'true');
  });

  it('opens the search dialog when the search trigger button is clicked', async () => {
    const user = userEvent.setup();
    render(<GardenSidebar categories={categories} />);

    expect(screen.getByTestId('command-dialog')).toHaveAttribute('data-open', 'false');

    const triggerButtons = screen.getAllByRole('button', { name: /searchPlaceholder/i });
    await user.click(triggerButtons[0]!);

    expect(screen.getByTestId('command-dialog')).toHaveAttribute('data-open', 'true');
  });

  it('navigates and closes the dialog when a search result is selected', async () => {
    const user = userEvent.setup();
    render(<GardenSidebar categories={categories} />);

    await user.keyboard('{Meta>}k{/Meta}');
    expect(screen.getByTestId('command-dialog')).toHaveAttribute('data-open', 'true');

    const items = screen.getAllByTestId('command-item');
    const target = items.find(item => item.textContent?.includes('First Subnote'));
    expect(target).toBeDefined();
    await user.click(target!);

    expect(mockPush).toHaveBeenCalledWith('/garden/projects/active/first');
    expect(screen.getByTestId('command-dialog')).toHaveAttribute('data-open', 'false');
  });

  it('flattens nested notes so descendants are searchable', async () => {
    const user = userEvent.setup();
    render(<GardenSidebar categories={categories} />);

    await user.keyboard('{Meta>}k{/Meta}');

    const itemLabels = screen.getAllByTestId('command-item').map(node => node.textContent ?? '');
    expect(itemLabels.some(label => label.includes('First Subnote'))).toBe(true);
    expect(itemLabels.some(label => label.includes('Second Subnote'))).toBe(true);
    expect(itemLabels.some(label => label.includes('Active Project'))).toBe(true);
  });
});
