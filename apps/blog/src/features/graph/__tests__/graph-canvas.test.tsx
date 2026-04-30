import { act, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';

import type { GraphData, GraphNode } from '../model/types';
import { GraphCanvas } from '../ui/graph-canvas';

import '@testing-library/jest-dom';

const mockUseTheme = jest.fn(() => ({ resolvedTheme: 'light' }) as { resolvedTheme: 'light' | 'dark' });

jest.mock('next-themes', () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock('lucide-react', () => ({
  MonitorIcon: (props: Record<string, unknown>) => <svg data-testid="monitor-icon" {...props} />,
}));

// Capture props passed to ForceGraph so tests can assert on the wiring without
// needing the real WebGL pipeline.
type CapturedProps = Record<string, unknown>;
const lastForceGraphProps: { current: CapturedProps | null } = { current: null };
const lastForceGraphRef: { current: unknown } = { current: null };

const fakeForceGraphInstance = {
  cameraPosition: jest.fn(),
  d3Force: jest.fn().mockReturnValue({ strength: jest.fn(), distance: jest.fn() }),
  controls: jest.fn().mockReturnValue({ dispose: jest.fn(), handleResize: jest.fn() }),
  renderer: jest.fn().mockReturnValue({ dispose: jest.fn() }),
  scene: jest.fn().mockReturnValue({ traverse: jest.fn() }),
};

jest.mock('react-force-graph-3d', () => {
  const ForwardedFakeForceGraph = React.forwardRef<unknown, CapturedProps>((props, ref) => {
    lastForceGraphProps.current = props;
    lastForceGraphRef.current = ref;
    React.useImperativeHandle(ref, () => fakeForceGraphInstance);
    return <div data-testid="force-graph" />;
  });
  ForwardedFakeForceGraph.displayName = 'FakeForceGraph';
  return { __esModule: true, default: ForwardedFakeForceGraph };
});

jest.mock('three-spritetext', () => {
  class FakeSpriteText {
    text = '';
    color = '';
    textHeight = 0;
    backgroundColor: string | boolean = '';
    padding = 0;
    borderRadius = 0;
  }
  return { __esModule: true, default: FakeSpriteText };
});

const mockData: GraphData = {
  nodes: [
    { id: 'note:a', name: 'Note A', type: 'note', status: 'seedling', linkCount: 1, url: '/garden/a' },
    { id: 'note:b', name: 'Note B', type: 'note', status: 'evergreen', linkCount: 2, url: '/garden/b' },
    { id: 'post:hello', name: 'Hello', type: 'post', category: 'essay', linkCount: 0, url: '/blog/essay/hello' },
    { id: 'tag:react', name: 'react', type: 'tag', linkCount: 1, url: '' },
    { id: 'cat:essay', name: 'essay', type: 'category', linkCount: 1, url: '' },
  ],
  links: [{ source: 'note:a', target: 'tag:react', type: 'tag' }],
};

const unsupportedLabels = {
  title: '이 기기에서 3D 그래프를 볼 수 없습니다',
  description: 'WebGPU를 지원하는 데스크톱 브라우저에서 확인해 주세요.',
};

describe('GraphCanvas — fallback paths (WebGL unavailable)', () => {
  it('renders fallback message when canvas.getContext returns null', async () => {
    render(<GraphCanvas data={mockData} unsupportedLabels={unsupportedLabels} />);

    await waitFor(() => {
      expect(screen.getByText(unsupportedLabels.title)).toBeInTheDocument();
    });
    expect(screen.getByText(unsupportedLabels.description)).toBeInTheDocument();
    expect(screen.getByTestId('monitor-icon')).toBeInTheDocument();
  });

  it('renders fallback when canvas.getContext throws', async () => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = jest.fn(() => {
      throw new Error('getContext blew up');
    }) as unknown as HTMLCanvasElement['getContext'];

    try {
      render(<GraphCanvas data={mockData} unsupportedLabels={unsupportedLabels} />);

      await waitFor(() => {
        expect(screen.getByText(unsupportedLabels.title)).toBeInTheDocument();
      });
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
    }
  });
});

describe('GraphCanvas — ForceGraph integration (WebGL available)', () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalResizeObserver = window.ResizeObserver;
  let resizeObserverCallback: ResizeObserverCallback | null = null;

  beforeEach(() => {
    lastForceGraphProps.current = null;
    lastForceGraphRef.current = null;
    fakeForceGraphInstance.cameraPosition.mockClear();
    fakeForceGraphInstance.d3Force.mockClear();
    fakeForceGraphInstance.controls.mockClear();
    mockUseTheme.mockReturnValue({ resolvedTheme: 'light' });

    // Pretend WebGL is available for these tests.
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({})) as unknown as HTMLCanvasElement['getContext'];

    // Capture ResizeObserver callback so we can drive it from tests.
    window.ResizeObserver = jest.fn().mockImplementation((cb: ResizeObserverCallback) => {
      resizeObserverCallback = cb;
      return { observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn() };
    }) as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    window.ResizeObserver = originalResizeObserver;
    resizeObserverCallback = null;
  });

  it('renders ForceGraph after dynamic imports resolve and forwards graph data', async () => {
    render(<GraphCanvas data={mockData} unsupportedLabels={unsupportedLabels} />);

    await waitFor(() => {
      expect(screen.getByTestId('force-graph')).toBeInTheDocument();
    });

    expect(lastForceGraphProps.current).not.toBeNull();
    const props = lastForceGraphProps.current as CapturedProps;
    const graphData = props.graphData as { nodes: GraphNode[]; links: unknown[] };
    expect(graphData.nodes).toHaveLength(mockData.nodes.length);
    expect(graphData.links).toHaveLength(mockData.links.length);
    expect(props.nodeId).toBe('id');
    expect(typeof props.nodeColor).toBe('function');
    expect(typeof props.nodeVal).toBe('function');
    expect(typeof props.nodeThreeObject).toBe('function');
  });

  it('configures d3Force when data ref changes after mount', async () => {
    const { rerender } = render(<GraphCanvas data={mockData} unsupportedLabels={unsupportedLabels} />);

    await waitFor(() => {
      expect(screen.getByTestId('force-graph')).toBeInTheDocument();
    });

    fakeForceGraphInstance.d3Force.mockClear();

    // 새 data 객체로 다시 그리면 fgRef가 이미 채워진 상태라 useEffect가 d3Force를 호출.
    rerender(
      <GraphCanvas
        data={{ nodes: [...mockData.nodes], links: [...mockData.links] }}
        unsupportedLabels={unsupportedLabels}
      />
    );

    expect(fakeForceGraphInstance.d3Force).toHaveBeenCalledWith('charge');
    expect(fakeForceGraphInstance.d3Force).toHaveBeenCalledWith('link');
    expect(fakeForceGraphInstance.d3Force).toHaveBeenCalledWith('center');
  });

  it('updates dimensions when ResizeObserver fires', async () => {
    render(<GraphCanvas data={mockData} unsupportedLabels={unsupportedLabels} />);

    await waitFor(() => {
      expect(screen.getByTestId('force-graph')).toBeInTheDocument();
    });

    act(() => {
      resizeObserverCallback?.(
        [{ contentRect: { width: 1024, height: 768 } as DOMRectReadOnly } as ResizeObserverEntry],
        {} as ResizeObserver
      );
    });

    const props = lastForceGraphProps.current as CapturedProps;
    expect(props.width).toBe(1024);
    expect(props.height).toBe(768);
  });

  describe('node color callback', () => {
    const getNodeColor = async () => {
      render(<GraphCanvas data={mockData} unsupportedLabels={unsupportedLabels} />);
      await waitFor(() => expect(screen.getByTestId('force-graph')).toBeInTheDocument());
      const props = lastForceGraphProps.current as CapturedProps;
      return props.nodeColor as (node: GraphNode) => string;
    };

    it('returns a non-empty color for each node type', async () => {
      const fn = await getNodeColor();
      const cases: GraphNode[] = [
        { id: 'note', name: 'n', type: 'note', status: 'budding', linkCount: 0, url: '' },
        { id: 'post', name: 'p', type: 'post', category: 'essay', linkCount: 0, url: '' },
        { id: 'tag', name: 't', type: 'tag', linkCount: 0, url: '' },
        { id: 'category', name: 'c', type: 'category', linkCount: 0, url: '' },
      ];
      cases.forEach(node => expect(typeof fn(node)).toBe('string'));
    });

    it('falls back to tag color for an unknown node type', async () => {
      const fn = await getNodeColor();
      // 강제로 unknown type 주입하여 default 분기 (line ~220) 진입
      const unknown = { id: 'x', name: 'x', type: 'unknown', linkCount: 0, url: '' } as unknown as GraphNode;
      expect(typeof fn(unknown)).toBe('string');
    });

    it('dims non-focused nodes when highlightNodeIds is non-empty', async () => {
      render(
        <GraphCanvas
          data={mockData}
          unsupportedLabels={unsupportedLabels}
          highlightNodeIds={new Set(['note:a'])}
          selectedNodeId="note:a"
        />
      );
      await waitFor(() => expect(screen.getByTestId('force-graph')).toBeInTheDocument());

      const fn = (lastForceGraphProps.current as CapturedProps).nodeColor as (node: GraphNode) => string;
      const dimmed = fn({ id: 'tag:react', name: 'react', type: 'tag', linkCount: 1, url: '' });
      const focused = fn({
        id: 'note:a',
        name: 'Note A',
        type: 'note',
        status: 'seedling',
        linkCount: 1,
        url: '/garden/a',
      });

      expect(dimmed).toMatch(/rgba\(/);
      expect(focused).not.toMatch(/rgba\(/);
    });

    it('uses dark-theme dim color when resolvedTheme is dark', async () => {
      mockUseTheme.mockReturnValue({ resolvedTheme: 'dark' });
      render(
        <GraphCanvas data={mockData} unsupportedLabels={unsupportedLabels} highlightNodeIds={new Set(['note:a'])} />
      );
      await waitFor(() => expect(screen.getByTestId('force-graph')).toBeInTheDocument());

      const fn = (lastForceGraphProps.current as CapturedProps).nodeColor as (node: GraphNode) => string;
      const dim = fn({ id: 'tag:react', name: 'react', type: 'tag', linkCount: 1, url: '' });
      expect(dim).toBe('rgba(255,255,255,0.08)');
    });
  });

  describe('node click handling', () => {
    it('invokes onNodeClick with the original GraphNode and pans the camera when coords are present', async () => {
      const onNodeClick = jest.fn();

      render(<GraphCanvas data={mockData} unsupportedLabels={unsupportedLabels} onNodeClick={onNodeClick} />);
      await waitFor(() => expect(screen.getByTestId('force-graph')).toBeInTheDocument());

      const handler = (lastForceGraphProps.current as CapturedProps).onNodeClick as (n: unknown) => void;

      act(() => {
        handler({ id: 'note:a', x: 10, y: 20, z: 30 });
      });

      expect(onNodeClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'note:a' }));
      expect(fakeForceGraphInstance.cameraPosition).toHaveBeenCalledTimes(1);
    });

    it('ignores clicks for unknown node ids', async () => {
      const onNodeClick = jest.fn();

      render(<GraphCanvas data={mockData} unsupportedLabels={unsupportedLabels} onNodeClick={onNodeClick} />);
      await waitFor(() => expect(screen.getByTestId('force-graph')).toBeInTheDocument());

      const handler = (lastForceGraphProps.current as CapturedProps).onNodeClick as (n: unknown) => void;

      act(() => {
        handler({ id: 'note:does-not-exist', x: 0, y: 0, z: 0 });
      });

      expect(onNodeClick).not.toHaveBeenCalled();
    });

    it('does not pan the camera when node coords are missing', async () => {
      const onNodeClick = jest.fn();

      render(<GraphCanvas data={mockData} unsupportedLabels={unsupportedLabels} onNodeClick={onNodeClick} />);
      await waitFor(() => expect(screen.getByTestId('force-graph')).toBeInTheDocument());

      const handler = (lastForceGraphProps.current as CapturedProps).onNodeClick as (n: unknown) => void;
      const initialCalls = fakeForceGraphInstance.cameraPosition.mock.calls.length;

      act(() => {
        handler({ id: 'note:a' }); // no x/y/z
      });

      expect(onNodeClick).toHaveBeenCalled();
      expect(fakeForceGraphInstance.cameraPosition.mock.calls.length).toBe(initialCalls);
    });
  });

  it('builds a SpriteText sprite for each node via nodeThreeObject', async () => {
    render(<GraphCanvas data={mockData} unsupportedLabels={unsupportedLabels} />);
    await waitFor(() => expect(screen.getByTestId('force-graph')).toBeInTheDocument());

    const nodeThreeObject = (lastForceGraphProps.current as CapturedProps).nodeThreeObject as (n: GraphNode) => {
      text: string;
      textHeight: number;
    };

    const noteSprite = nodeThreeObject(mockData.nodes[0]!);
    const tagSprite = nodeThreeObject(mockData.nodes[3]!);

    expect(noteSprite.text).toBe('Note A');
    expect(noteSprite.textHeight).toBe(3);
    // tag/category는 secondary 노드라 text height가 더 작음.
    expect(tagSprite.textHeight).toBe(2);
  });
});
