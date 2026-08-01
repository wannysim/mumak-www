import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { GraphData, GraphNode } from '../model/types';
import { GraphView } from '../ui/graph-view';

import '@testing-library/jest-dom';

const mockUseSearchParams = jest.fn(() => new URLSearchParams());
let shouldCanvasCrash = false;

jest.mock('next/navigation', () => ({
  useSearchParams: () => mockUseSearchParams(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

// next/dynamic은 SSR 모듈을 비동기로 로드하므로 jest 환경에서는 sync 컴포넌트로 대체.
// shouldCanvasCrash 플래그로 동일 컴포넌트가 ErrorBoundary 검증 시 throw하도록 분기.
// canvasReady는 실제 GraphCanvas가 WebGL 지원 + 라이브러리 로드 완료일 때 올리는 신호라,
// 노드를 렌더하는 이 mock은 항상 true를 보고한다(= 범례가 뜨는 조건).
jest.mock('next/dynamic', () => () => {
  const Mock = ({
    data,
    onNodeClick,
    selectedNodeId,
    highlightNodeIds,
    unsupportedLabels,
    onReadyChange,
  }: {
    data: GraphData;
    onNodeClick?: (node: GraphNode) => void;
    selectedNodeId?: string | null;
    highlightNodeIds?: Set<string>;
    unsupportedLabels: { title: string; description: string };
    onReadyChange?: (ready: boolean) => void;
  }) => {
    // 훅을 throw보다 먼저 호출한다. 렌더가 throw하면 effect는 flush되지 않으므로
    // 크래시 분기에서 canvasReady가 올라가는 일도 없다.
    // jest.mock 팩토리는 호이스팅되므로 모듈 스코프 import를 참조할 수 없다.
    const React = require('react');
    React.useEffect(() => onReadyChange?.(true), [onReadyChange]);

    if (shouldCanvasCrash) {
      throw new Error('GraphCanvas crashed');
    }
    return (
      <div
        data-testid="graph-canvas"
        data-node-count={data.nodes.length}
        data-link-count={data.links.length}
        data-selected-id={selectedNodeId ?? ''}
        data-highlight-ids={highlightNodeIds ? [...highlightNodeIds].toSorted().join(',') : ''}
        data-unsupported-title={unsupportedLabels.title}
      >
        {data.nodes.map(node => (
          <button key={node.id} type="button" data-testid={`graph-node-${node.id}`} onClick={() => onNodeClick?.(node)}>
            {node.name}
          </button>
        ))}
      </div>
    );
  };
  return Mock;
});

jest.mock('../ui/graph-toolbar', () => ({
  GraphToolbar: ({ locale }: { locale: string }) => <div data-testid="graph-toolbar">{locale}</div>,
}));

jest.mock('../ui/graph-tabs', () => ({
  GraphTabs: ({ activeTab }: { activeTab: string }) => <div data-testid="graph-tabs">{activeTab}</div>,
}));

jest.mock('../ui/graph-controls', () => ({
  GraphControls: ({
    activeTab,
    searchQuery,
    onSearchChange,
    activeFilters,
    onFilterToggle,
    onClearFilters,
  }: {
    activeTab: string;
    searchQuery: string;
    onSearchChange: (q: string) => void;
    activeFilters: string[];
    onFilterToggle: (f: string) => void;
    onClearFilters: () => void;
  }) => (
    <div data-testid="graph-controls" data-active-tab={activeTab}>
      <input data-testid="search-input" value={searchQuery} onChange={e => onSearchChange(e.target.value)} />
      <button type="button" data-testid="filter-status" onClick={() => onFilterToggle('status:seedling')}>
        toggle status:seedling
      </button>
      <button type="button" data-testid="filter-tag" onClick={() => onFilterToggle('tag:react')}>
        toggle tag:react
      </button>
      <button type="button" data-testid="clear-filters" onClick={onClearFilters}>
        clear
      </button>
      <span data-testid="active-filters">{activeFilters.join('|')}</span>
    </div>
  ),
}));

jest.mock('../ui/graph-detail-panel', () => ({
  GraphDetailPanel: ({ node, open, onClose }: { node: GraphNode | null; open: boolean; onClose: () => void }) => (
    <div data-testid="graph-detail-panel" data-open={open ? 'true' : 'false'}>
      <span data-testid="panel-node-id">{node?.id ?? ''}</span>
      <button type="button" data-testid="panel-close" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

const gardenData: GraphData = {
  nodes: [
    { id: 'note:a', name: 'Note A', type: 'note', status: 'seedling', linkCount: 1, url: '/garden/a' },
    { id: 'note:b', name: 'Note B', type: 'note', status: 'evergreen', linkCount: 1, url: '/garden/b' },
    { id: 'tag:react', name: 'react', type: 'tag', linkCount: 2, url: '' },
  ],
  links: [
    { source: 'note:a', target: 'tag:react', type: 'tag' },
    { source: 'note:b', target: 'tag:react', type: 'tag' },
  ],
};

const blogData: GraphData = {
  nodes: [
    { id: 'post:hello', name: 'Hello', type: 'post', category: 'essay', linkCount: 0, url: '/blog/essay/hello' },
    // 카테고리 노드의 name은 지역화된 표시 문구, id는 원문 슬러그를 유지한다.
    { id: 'category:essay', name: 'Essay', type: 'category', linkCount: 1, url: '' },
  ],
  links: [{ source: 'post:hello', target: 'category:essay', type: 'category' }],
};

const labels: React.ComponentProps<typeof GraphView>['labels'] = {
  tabs: { garden: 'Garden', blog: 'Blog' },
  controls: {
    back: 'Back',
    search: 'Search',
    filter: 'Filter',
    clearFilters: 'Clear',
    noResults: 'No results',
    status: 'Status',
    tags: 'Tags',
    categories: 'Categories',
  },
  panel: {
    description: 'Node detail panel',
    close: 'Close',
    viewDetail: 'View',
    connections: 'connections',
    type: { note: 'Note', post: 'Post', tag: 'Tag', category: 'Category' },
    status: { seedling: 'Seedling', budding: 'Budding', evergreen: 'Evergreen' },
    category: { essay: 'Essay' },
  },
  legend: {
    title: 'Legend',
    hint: 'Click a node to see its details',
    dismissHint: 'Dismiss hint',
    sizeNote: 'Node size scales with connections',
    items: {
      'status:seedling': 'Seedling',
      'status:evergreen': 'Evergreen',
      'category:essay': 'Essay',
      'type:category': 'Category',
      'type:tag': 'Tag',
    },
  },
  unsupported: { title: 'Unsupported', description: 'Use a desktop browser' },
  error: { title: 'Error', description: 'Something went wrong' },
};

describe('GraphView', () => {
  beforeEach(() => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    localStorage.clear();
  });

  it('defaults to the garden tab and uses gardenData', () => {
    render(<GraphView gardenData={gardenData} blogData={blogData} locale="en" labels={labels} />);

    const canvas = screen.getByTestId('graph-canvas');
    expect(canvas).toHaveAttribute('data-node-count', '3');
    expect(canvas).toHaveAttribute('data-link-count', '2');
    expect(screen.getByTestId('graph-controls')).toHaveAttribute('data-active-tab', 'garden');
  });

  it('switches to blogData when ?tab=blog is in the URL', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('tab=blog'));

    render(<GraphView gardenData={gardenData} blogData={blogData} locale="en" labels={labels} />);

    const canvas = screen.getByTestId('graph-canvas');
    expect(canvas).toHaveAttribute('data-node-count', '2');
    expect(screen.getByTestId('graph-controls')).toHaveAttribute('data-active-tab', 'blog');
  });

  it('passes search query through to highlightNodeIds (case-insensitive name match)', async () => {
    const user = userEvent.setup();

    render(<GraphView gardenData={gardenData} blogData={blogData} locale="en" labels={labels} />);

    await user.type(screen.getByTestId('search-input'), 'note a');

    const canvas = screen.getByTestId('graph-canvas');
    expect(canvas).toHaveAttribute('data-highlight-ids', 'note:a');
  });

  // 카테고리 노드의 표시 이름이 지역화되면서 슬러그 검색이 죽지 않았는지 고정한다.
  const localizedBlogData: GraphData = {
    nodes: [
      { id: 'post:hello', name: 'Hello', type: 'post', category: 'essay', linkCount: 1, url: '/blog/essay/hello' },
      { id: 'category:essay', name: '에세이', type: 'category', linkCount: 1, url: '' },
    ],
    links: [{ source: 'post:hello', target: 'category:essay', type: 'category' }],
  };

  it('finds a localized category node by its display label', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('tab=blog'));
    const user = userEvent.setup();

    render(<GraphView gardenData={gardenData} blogData={localizedBlogData} locale="ko" labels={labels} />);

    await user.type(screen.getByTestId('search-input'), '에세이');

    expect(screen.getByTestId('graph-canvas')).toHaveAttribute('data-highlight-ids', 'category:essay');
  });

  it('still finds a localized category node by its raw slug', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('tab=blog'));
    const user = userEvent.setup();

    render(<GraphView gardenData={gardenData} blogData={localizedBlogData} locale="ko" labels={labels} />);

    // 표시 이름이 '에세이'로 바뀌어도 URL·기존 동작의 슬러그 'essay'로 계속 찾을 수 있어야 한다.
    await user.type(screen.getByTestId('search-input'), 'essay');

    expect(screen.getByTestId('graph-canvas')).toHaveAttribute('data-highlight-ids', 'category:essay');
  });

  // 'go'는 'category:essay'의 'cate-go-ry'에 들어 있다. 슬러그 폴백이 id 전체를 보면
  // 흔한 질의마다 카테고리 허브가 전부 오탐된다.
  it.each(['go', 'cat', 'ory'])('does not match category hubs through the "category:" prefix (%s)', async query => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('tab=blog'));
    const user = userEvent.setup();

    render(<GraphView gardenData={gardenData} blogData={localizedBlogData} locale="ko" labels={labels} />);

    await user.type(screen.getByTestId('search-input'), query);

    expect(screen.getByTestId('graph-canvas')).toHaveAttribute('data-highlight-ids', '');
  });

  it('does not match a whole node type through its id prefix', async () => {
    const user = userEvent.setup();

    render(<GraphView gardenData={gardenData} blogData={blogData} locale="en" labels={labels} />);

    // 'note'는 note: 접두사를 가진 모든 노드의 id에 들어 있지만, 슬러그 폴백은 카테고리 노드 전용이다.
    await user.type(screen.getByTestId('search-input'), 'note:');

    expect(screen.getByTestId('graph-canvas')).toHaveAttribute('data-highlight-ids', '');
  });

  it('non-tag filters highlight only the matching nodes (no neighbour expansion)', async () => {
    const user = userEvent.setup();

    render(<GraphView gardenData={gardenData} blogData={blogData} locale="en" labels={labels} />);

    await user.click(screen.getByTestId('filter-status'));

    const canvas = screen.getByTestId('graph-canvas');
    // status:seedling matches note:a only — note:b (evergreen) and tag:react are NOT highlighted.
    expect(canvas).toHaveAttribute('data-highlight-ids', 'note:a');
  });

  it('tag filters expand to neighbour nodes via the link graph', async () => {
    const user = userEvent.setup();

    render(<GraphView gardenData={gardenData} blogData={blogData} locale="en" labels={labels} />);

    await user.click(screen.getByTestId('filter-tag'));

    const canvas = screen.getByTestId('graph-canvas');
    // tag:react seed → expands to note:a and note:b through links.
    expect(canvas).toHaveAttribute('data-highlight-ids', 'note:a,note:b,tag:react');
  });

  it('clearFilters resets active filters', async () => {
    const user = userEvent.setup();

    render(<GraphView gardenData={gardenData} blogData={blogData} locale="en" labels={labels} />);

    await user.click(screen.getByTestId('filter-status'));
    expect(screen.getByTestId('active-filters')).toHaveTextContent('status:seedling');

    await user.click(screen.getByTestId('clear-filters'));
    expect(screen.getByTestId('active-filters')).toHaveTextContent('');
  });

  it('toggling the same filter twice removes it', async () => {
    const user = userEvent.setup();

    render(<GraphView gardenData={gardenData} blogData={blogData} locale="en" labels={labels} />);

    await user.click(screen.getByTestId('filter-status'));
    expect(screen.getByTestId('active-filters')).toHaveTextContent('status:seedling');

    await user.click(screen.getByTestId('filter-status'));
    expect(screen.getByTestId('active-filters')).toHaveTextContent('');
  });

  it('clicking a node opens the detail panel with that node', async () => {
    const user = userEvent.setup();

    render(<GraphView gardenData={gardenData} blogData={blogData} locale="en" labels={labels} />);

    expect(screen.getByTestId('graph-detail-panel')).toHaveAttribute('data-open', 'false');

    await user.click(screen.getByTestId('graph-node-note:a'));

    expect(screen.getByTestId('graph-detail-panel')).toHaveAttribute('data-open', 'true');
    expect(screen.getByTestId('panel-node-id')).toHaveTextContent('note:a');
  });

  it('closing the panel clears selection and hides detail', async () => {
    const user = userEvent.setup();

    render(<GraphView gardenData={gardenData} blogData={blogData} locale="en" labels={labels} />);

    await user.click(screen.getByTestId('graph-node-note:a'));
    expect(screen.getByTestId('graph-detail-panel')).toHaveAttribute('data-open', 'true');

    await user.click(screen.getByTestId('panel-close'));

    expect(screen.getByTestId('graph-detail-panel')).toHaveAttribute('data-open', 'false');
    expect(screen.getByTestId('panel-node-id')).toHaveTextContent('');
  });

  it('passes empty highlightNodeIds (undefined) when no search/filter is active', () => {
    render(<GraphView gardenData={gardenData} blogData={blogData} locale="en" labels={labels} />);

    // 빈 highlight 셋은 GraphCanvas로 undefined가 전달되도록 GraphView에서 가드 처리됨.
    expect(screen.getByTestId('graph-canvas')).toHaveAttribute('data-highlight-ids', '');
  });

  it('shows the first-visit hint alongside the legend when nothing is stored', () => {
    render(<GraphView gardenData={gardenData} blogData={blogData} locale="en" labels={labels} />);

    expect(screen.getByText(labels.legend.hint)).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Legend' })).toBeInTheDocument();
  });

  it('clicking a node retires the hint and remembers it', async () => {
    const user = userEvent.setup();

    render(<GraphView gardenData={gardenData} blogData={blogData} locale="en" labels={labels} />);

    await user.click(screen.getByTestId('graph-node-note:a'));

    expect(screen.queryByText(labels.legend.hint)).not.toBeInTheDocument();
    expect(localStorage.getItem('graph-hint-seen')).toBe('1');
  });

  it('dismissing the hint keeps the legend rows visible', async () => {
    const user = userEvent.setup();

    render(<GraphView gardenData={gardenData} blogData={blogData} locale="en" labels={labels} />);

    await user.click(screen.getByRole('button', { name: labels.legend.dismissHint }));

    expect(screen.queryByText(labels.legend.hint)).not.toBeInTheDocument();
    expect(screen.getByText('Seedling')).toBeInTheDocument();
    expect(localStorage.getItem('graph-hint-seen')).toBe('1');
  });

  it('never shows the hint again once it is stored, but still renders the legend', () => {
    localStorage.setItem('graph-hint-seen', '1');

    render(<GraphView gardenData={gardenData} blogData={blogData} locale="en" labels={labels} />);

    expect(screen.queryByText(labels.legend.hint)).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map(li => li.textContent)).toEqual(['Seedling', 'Evergreen', 'Tag']);
  });

  it('legend rows follow the active tab', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('tab=blog'));

    render(<GraphView gardenData={gardenData} blogData={blogData} locale="en" labels={labels} />);

    expect(screen.getAllByRole('listitem').map(li => li.textContent)).toEqual(['Essay', 'Category']);
  });

  it('renders both GraphTabs instances (desktop top + mobile bottom)', () => {
    render(<GraphView gardenData={gardenData} blogData={blogData} locale="en" labels={labels} />);

    const tabs = screen.getAllByTestId('graph-tabs');
    expect(tabs).toHaveLength(2);
    tabs.forEach(t => expect(t).toHaveTextContent('garden'));
  });
});

describe('GraphErrorBoundary (via GraphView)', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    shouldCanvasCrash = true;
  });

  afterEach(() => {
    shouldCanvasCrash = false;
    consoleErrorSpy.mockRestore();
  });

  it('catches errors thrown by GraphCanvas and renders the fallback labels', () => {
    render(<GraphView gardenData={gardenData} blogData={blogData} locale="en" labels={labels} />);

    expect(screen.getByText(labels.error.title)).toBeInTheDocument();
    expect(screen.getByText(labels.error.description)).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith('[GraphErrorBoundary]', expect.any(Error), expect.any(Object));
  });
});
