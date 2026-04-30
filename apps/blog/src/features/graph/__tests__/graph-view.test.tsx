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
jest.mock('next/dynamic', () => () => {
  const Mock = ({
    data,
    onNodeClick,
    selectedNodeId,
    highlightNodeIds,
    unsupportedLabels,
  }: {
    data: GraphData;
    onNodeClick?: (node: GraphNode) => void;
    selectedNodeId?: string | null;
    highlightNodeIds?: Set<string>;
    unsupportedLabels: { title: string; description: string };
  }) => {
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
    { id: 'cat:essay', name: 'essay', type: 'category', linkCount: 1, url: '' },
  ],
  links: [{ source: 'post:hello', target: 'cat:essay', type: 'category' }],
};

const labels: React.ComponentProps<typeof GraphView>['labels'] = {
  tabs: { garden: 'Garden', blog: 'Blog' },
  controls: {
    search: 'Search',
    filter: 'Filter',
    clearFilters: 'Clear',
    noResults: 'No results',
    status: 'Status',
    tags: 'Tags',
    categories: 'Categories',
  },
  panel: {
    viewDetail: 'View',
    connections: 'connections',
    type: { note: 'Note', post: 'Post', tag: 'Tag', category: 'Category' },
    status: { seedling: 'Seedling', budding: 'Budding', evergreen: 'Evergreen' },
  },
  unsupported: { title: 'Unsupported', description: 'Use a desktop browser' },
  error: { title: 'Error', description: 'Something went wrong' },
};

describe('GraphView', () => {
  beforeEach(() => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
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
