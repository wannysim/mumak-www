import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { SearchIndex, SearchIndexPost } from '@/src/shared/lib/search';

import { BlogSearch } from '../ui/blog-search';

import '@testing-library/jest-dom';

// useSearchIndex는 locale별로 fetch 결과를 모듈 레벨에 캐시한다. 테스트마다 고유 locale을 줘서
// 캐시가 테스트 간에 섞이지 않게 한다 (모듈 리셋 없이 격리).
let mockLocale = 'ko';

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
  useLocale: () => mockLocale,
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

const posts: SearchIndexPost[] = [
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

const realFetch = globalThis.fetch;

afterAll(() => {
  globalThis.fetch = realFetch;
});

// 검색 인덱스는 검색창을 열 때 lazy fetch된다. 정적 search-index.json 응답을 모킹한다.
// jsdom 환경에는 전역 Response가 없으므로 hook이 사용하는 최소 형태(ok/status/json)만 흉내낸다.
function mockSearchIndexFetch(index: SearchIndex = { posts }) {
  const response = { ok: true, status: 200, json: () => Promise.resolve(index) } as Response;
  const fetchMock = jest.fn().mockResolvedValue(response);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('BlogSearch', () => {
  let localeCounter = 0;

  beforeEach(() => {
    mockPush.mockClear();
    mockLocale = `ko-test-${(localeCounter += 1)}`;
  });

  it('renders a search trigger button', () => {
    mockSearchIndexFetch();
    render(<BlogSearch categoryLabels={categoryLabels} />);

    expect(screen.getByRole('button', { name: /placeholder|aria/i })).toBeInTheDocument();
  });

  it('does not fetch the search index until the palette is opened', async () => {
    const fetchSpy = mockSearchIndexFetch();
    render(<BlogSearch categoryLabels={categoryLabels} />);

    expect(fetchSpy).not.toHaveBeenCalled();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button'));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith(`/${mockLocale}/search-index.json`));
  });

  it('opens the palette when the trigger is clicked', async () => {
    mockSearchIndexFetch();
    const user = userEvent.setup();
    render(<BlogSearch categoryLabels={categoryLabels} />);

    expect(screen.getByTestId('command-dialog')).toHaveAttribute('data-open', 'false');

    await user.click(screen.getByRole('button'));

    expect(screen.getByTestId('command-dialog')).toHaveAttribute('data-open', 'true');
  });

  it('opens the palette via the Cmd+K shortcut', async () => {
    mockSearchIndexFetch();
    const user = userEvent.setup();
    render(<BlogSearch categoryLabels={categoryLabels} />);

    await user.keyboard('{Meta>}k{/Meta}');

    expect(screen.getByTestId('command-dialog')).toHaveAttribute('data-open', 'true');
  });

  it('groups fetched posts by category using the provided labels', async () => {
    mockSearchIndexFetch();
    const user = userEvent.setup();
    render(<BlogSearch categoryLabels={categoryLabels} />);

    await user.click(screen.getByRole('button'));

    await waitFor(() => expect(screen.getAllByTestId('command-group-heading').length).toBeGreaterThan(0));
    const headings = screen.getAllByTestId('command-group-heading').map(node => node.textContent);
    expect(headings).toEqual(['Essay', 'Articles', 'Notes']);
  });

  it('builds command-item values that include description and tags so fuzzy matching covers them', async () => {
    mockSearchIndexFetch();
    const user = userEvent.setup();
    render(<BlogSearch categoryLabels={categoryLabels} />);

    await user.click(screen.getByRole('button'));

    await waitFor(() =>
      expect(screen.getAllByTestId('command-item').some(item => item.textContent?.includes('Hello Essay'))).toBe(true)
    );
    const helloEssay = screen.getAllByTestId('command-item').find(item => item.textContent?.includes('Hello Essay'));
    const value = helloEssay!.getAttribute('data-value') ?? '';
    expect(value).toContain('My first essay');
    expect(value).toContain('intro');
    expect(value).toContain('thoughts');
  });

  it('navigates to /blog/{category}/{slug} when a post is selected', async () => {
    mockSearchIndexFetch();
    const user = userEvent.setup();
    render(<BlogSearch categoryLabels={categoryLabels} />);

    await user.click(screen.getByRole('button'));

    await waitFor(() =>
      expect(screen.getAllByTestId('command-item').some(node => node.textContent?.includes('Deep Article'))).toBe(true)
    );
    const item = screen.getAllByTestId('command-item').find(node => node.textContent?.includes('Deep Article'));
    await user.click(item!);

    expect(mockPush).toHaveBeenCalledWith('/blog/articles/deep-article');
  });

  it('degrades gracefully to an empty palette when the index fetch fails', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('network')) as unknown as typeof fetch;
    const user = userEvent.setup();
    render(<BlogSearch categoryLabels={categoryLabels} />);

    await user.click(screen.getByRole('button'));

    expect(screen.getByTestId('command-dialog')).toHaveAttribute('data-open', 'true');
    await waitFor(() => expect(screen.queryAllByTestId('command-item')).toHaveLength(0));
  });
});
