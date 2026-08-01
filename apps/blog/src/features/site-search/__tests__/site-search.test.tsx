import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { SearchIndex } from '@/src/shared/lib/search';

import { SiteSearch } from '../ui/site-search';

import '@testing-library/jest-dom';

const mockUsePathname = jest.fn(() => '/');
const mockPush = jest.fn();

jest.mock('@/src/shared/config/i18n', () => ({
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
  useLocale: () => 'ko',
}));

const mockUseSearchIndex = jest.fn();

jest.mock('@/src/shared/hooks', () => ({
  useSearchIndex: (locale: string, enabled: boolean) => mockUseSearchIndex(locale, enabled),
  useSearchPaletteShortcut: (setOpen: React.Dispatch<React.SetStateAction<boolean>>) => {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(() => {
      const handler = (event: KeyboardEvent) => {
        if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          setOpen(prev => !prev);
        }
      };
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }, [setOpen]);
  },
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

const index: SearchIndex = {
  posts: [
    { title: 'Essay Post', description: 'an essay', category: 'essay', slug: 'essay-post', tags: ['thought'] },
    { title: 'Article Post', description: 'an article', category: 'articles', slug: 'article-post', tags: ['web'] },
  ],
  notes: [{ title: 'Garden Note', excerpt: 'a note', slug: 'garden-note', tags: ['idea'] }],
};

const categoryLabels = { essay: '에세이', articles: '아티클', notes: '단상' };

function renderSearch() {
  return render(<SiteSearch categoryLabels={categoryLabels} />);
}

function itemLabels() {
  return screen.getAllByTestId('command-item').map(node => node.textContent ?? '');
}

describe('SiteSearch', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/');
    mockUseSearchIndex.mockReturnValue(index);
    mockPush.mockClear();
  });

  it('does not request the index until the palette is opened', () => {
    renderSearch();

    expect(mockUseSearchIndex).toHaveBeenCalledWith('ko', false);
  });

  it('opens via the Cmd/Ctrl+K shortcut from any page', async () => {
    const user = userEvent.setup();
    renderSearch();

    expect(screen.getByTestId('command-dialog')).toHaveAttribute('data-open', 'false');

    await user.keyboard('{Meta>}k{/Meta}');

    expect(screen.getByTestId('command-dialog')).toHaveAttribute('data-open', 'true');
    expect(mockUseSearchIndex).toHaveBeenLastCalledWith('ko', true);
  });

  // 홈/소개/now처럼 섹션 밖 페이지에서는 스코프가 없으므로 글과 노트가 한 번에 나와야 한다.
  it('searches posts and notes together outside blog and garden', async () => {
    const user = userEvent.setup();
    renderSearch();

    await user.keyboard('{Meta>}k{/Meta}');

    expect(itemLabels()).toEqual(expect.arrayContaining(['Essay Post', 'Article Post', 'Garden Note']));
  });

  it('scopes to blog results when opened inside the blog section', async () => {
    mockUsePathname.mockReturnValue('/blog/essay');
    const user = userEvent.setup();
    renderSearch();

    await user.keyboard('{Meta>}k{/Meta}');

    const labels = itemLabels();
    expect(labels).toEqual(expect.arrayContaining(['Essay Post', 'Article Post']));
    expect(labels).not.toContain('Garden Note');
  });

  it('scopes to garden results when opened inside the garden section', async () => {
    mockUsePathname.mockReturnValue('/garden/garden-note');
    const user = userEvent.setup();
    renderSearch();

    await user.keyboard('{Meta>}k{/Meta}');

    const labels = itemLabels();
    expect(labels).toContain('Garden Note');
    expect(labels).not.toContain('Essay Post');
  });

  it('widens a scoped search to the whole site on request', async () => {
    mockUsePathname.mockReturnValue('/garden');
    const user = userEvent.setup();
    renderSearch();

    await user.keyboard('{Meta>}k{/Meta}');
    expect(itemLabels()).not.toContain('Essay Post');

    await user.click(screen.getByRole('button', { name: 'searchEverywhere' }));

    expect(itemLabels()).toEqual(expect.arrayContaining(['Essay Post', 'Garden Note']));
  });

  // 넓혀둔 범위가 다음 검색까지 따라오면 푸터 문구와 실제 결과가 어긋난다.
  it('returns to the section scope the next time the palette opens', async () => {
    mockUsePathname.mockReturnValue('/garden');
    const user = userEvent.setup();
    renderSearch();

    await user.keyboard('{Meta>}k{/Meta}');
    await user.click(screen.getByRole('button', { name: 'searchEverywhere' }));
    expect(itemLabels()).toContain('Essay Post');

    await user.keyboard('{Meta>}k{/Meta}');
    await user.keyboard('{Meta>}k{/Meta}');

    expect(itemLabels()).not.toContain('Essay Post');
  });

  it('navigates to the selected result', async () => {
    const user = userEvent.setup();
    renderSearch();

    await user.keyboard('{Meta>}k{/Meta}');
    const target = screen.getAllByTestId('command-item').find(node => node.textContent?.includes('Garden Note'));
    await user.click(target!);

    expect(mockPush).toHaveBeenCalledWith('/garden/garden-note');
  });

  it('degrades to an empty palette when the index fails to load', async () => {
    mockUseSearchIndex.mockReturnValue({ posts: [], notes: [] });
    const user = userEvent.setup();
    renderSearch();

    await user.keyboard('{Meta>}k{/Meta}');

    expect(screen.queryAllByTestId('command-item')).toHaveLength(0);
    expect(screen.getByText('empty')).toBeInTheDocument();
  });
});
