'use client';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Component, useCallback, useMemo, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

import type { GraphData, GraphNode, GraphTab } from '../model/types';
import { GraphControls } from './graph-controls';
import { GraphDetailPanel } from './graph-detail-panel';
import { GraphLegend } from './graph-legend';
import { GraphTabs } from './graph-tabs';
import { GraphToolbar } from './graph-toolbar';

const GraphCanvas = dynamic(() => import('./graph-canvas').then(m => ({ default: m.GraphCanvas })), {
  ssr: false,
});

interface FallbackLabels {
  title: string;
  description: string;
}

class GraphErrorBoundary extends Component<{ children: ReactNode; labels: FallbackLabels }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; labels: FallbackLabels }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[GraphErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm font-medium text-foreground">{this.props.labels.title}</p>
          <p className="text-xs text-muted-foreground">{this.props.labels.description}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

interface GraphViewProps {
  gardenData: GraphData;
  blogData: GraphData;
  locale: string;
  labels: {
    tabs: { garden: string; blog: string };
    controls: {
      back: string;
      search: string;
      filter: string;
      clearFilters: string;
      noResults: string;
      status: string;
      tags: string;
      categories: string;
    };
    panel: {
      description: string;
      close: string;
      viewDetail: string;
      connections: string;
      type: Record<string, string>;
      status: Record<string, string>;
      category: Record<string, string>;
    };
    legend: {
      title: string;
      hint: string;
      dismissHint: string;
      sizeNote: string;
      items: Record<string, string>;
    };
    unsupported: FallbackLabels;
    error: FallbackLabels;
  };
}

function resolveLinkEndpoint(endpoint: string | GraphNode): string {
  return typeof endpoint === 'string' ? endpoint : (endpoint as unknown as GraphNode).id;
}

// 필터 키 접두사 → 매칭 predicate. 새 필터 축은 이 맵에 한 줄만 더하면 되고
// GraphControls가 만드는 필터 키(`{axis}:{value}`)와 여기서 대응된다.
const FILTER_MATCHERS: Record<string, (node: GraphNode, value: string) => boolean> = {
  status: (node, value) => node.status === value,
  category: (node, value) => node.category === value,
  tag: (node, value) => node.type === 'tag' && node.name === value,
};

function nodeMatchesFilter(node: GraphNode, filter: string): boolean {
  const [type, value] = filter.split(':');
  return type ? (FILTER_MATCHERS[type]?.(node, value ?? '') ?? false) : false;
}

function collectNeighborIds(data: GraphData, seedIds: Set<string>): Set<string> {
  const expanded = new Set(seedIds);

  for (const link of data.links) {
    const source = resolveLinkEndpoint(link.source);
    const target = resolveLinkEndpoint(link.target);
    if (expanded.has(source)) expanded.add(target);
    if (expanded.has(target)) expanded.add(source);
  }

  return expanded;
}

// 카테고리 노드의 표시 이름만 로케일 문구('에세이')라 원문 슬러그로는 더 이상 매칭되지 않는다.
// 그 노드에 한해 슬러그(`category:essay`의 `essay`)도 함께 본다. id 전체를 보면 'category'
// 접두사가 질의에 걸려('go'가 cate-go-ry에 포함) 무관한 검색에도 카테고리 허브가 전부 뜬다.
const CATEGORY_ID_PREFIX = 'category:';

function nodeMatchesQuery(node: GraphNode, query: string): boolean {
  if (node.name.toLowerCase().includes(query)) return true;
  return node.type === 'category' && node.id.slice(CATEGORY_ID_PREFIX.length).toLowerCase().includes(query);
}

function buildHighlightIds(data: GraphData, filters: string[], searchQuery: string): Set<string> {
  const ids = new Set<string>();
  const query = searchQuery.toLowerCase();
  const tagFilters = filters.filter(f => f.startsWith('tag:'));
  const nonTagFilters = filters.filter(f => !f.startsWith('tag:'));
  const tagMatchIds = new Set<string>();

  // 검색·필터·태그 매칭을 노드 리스트 한 번의 순회로 모두 수집한다.
  for (const node of data.nodes) {
    if (searchQuery && nodeMatchesQuery(node, query)) ids.add(node.id);
    if (nonTagFilters.some(f => nodeMatchesFilter(node, f))) ids.add(node.id);
    if (tagFilters.some(f => nodeMatchesFilter(node, f))) tagMatchIds.add(node.id);
  }

  if (tagMatchIds.size > 0) {
    for (const id of collectNeighborIds(data, tagMatchIds)) {
      ids.add(id);
    }
  }

  return ids;
}

const HINT_STORAGE_KEY = 'graph-hint-seen';

// 최초 진입 1회 힌트. 노드를 한 번 클릭했거나(=힌트가 할 일을 끝냈거나) 닫기를 누르면
// 다시 보이지 않는다. 초기값을 effect가 아니라 initializer에서 읽는 이유는 재방문자에게
// 힌트가 한 프레임 번쩍이지 않게 하려는 것이고, GraphLegend가 canvasReady 게이트 뒤에서만
// 렌더되므로(서버·첫 클라이언트 렌더 모두 false) SSR 출력과 갈릴 수 없다.
function useHintSeen(): [boolean, () => void] {
  const [seen, setSeen] = useState(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem(HINT_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const markSeen = useCallback(() => {
    setSeen(true);
    try {
      localStorage.setItem(HINT_STORAGE_KEY, '1');
    } catch {
      // Safari private mode 등 쓰기 불가 환경. 힌트가 다음 방문에 한 번 더 뜰 뿐이다.
    }
  }, []);

  return [seen, markSeen];
}

function GraphView({ gardenData, blogData, locale, labels }: GraphViewProps) {
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get('tab') as GraphTab) || 'garden';
  const data = activeTab === 'garden' ? gardenData : blogData;

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [hintSeen, markHintSeen] = useHintSeen();

  const toggleFilter = useCallback((filter: string) => {
    setActiveFilters(prev => (prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]));
  }, []);

  const clearFilters = useCallback(() => setActiveFilters([]), []);

  const selectNode = useCallback(
    (node: GraphNode) => {
      setSelectedNode(node);
      setPanelOpen(true);
      markHintSeen();
    },
    [markHintSeen]
  );

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setSelectedNode(null);
  }, []);

  const highlightNodeIds = useMemo(
    () => buildHighlightIds(data, activeFilters, searchQuery),
    [data, activeFilters, searchQuery]
  );

  return (
    <div className="relative w-full h-dvh">
      <GraphToolbar locale={locale} backLabel={labels.controls.back} />

      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 hidden md:block">
        <GraphTabs activeTab={activeTab} labels={labels.tabs} />
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 md:hidden">
        <GraphTabs activeTab={activeTab} labels={labels.tabs} />
      </div>

      <GraphControls
        data={data}
        activeTab={activeTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeFilters={activeFilters}
        onFilterToggle={toggleFilter}
        onClearFilters={clearFilters}
        labels={labels.controls}
        optionLabels={labels.legend.items}
      />

      {/* 범례는 캔버스의 형제가 아니라 자식으로 둔다. 캔버스가 미지원 폴백·로딩 스켈레톤이면
          canvasReady가 false이고, 렌더 중 throw하면 ErrorBoundary가 이 subtree를 통째로
          대체한다. 세 경우 모두 "노드가 하나도 없는 화면"이라 범례와 클릭 힌트는 거짓말이 된다. */}
      <GraphErrorBoundary labels={labels.error}>
        <GraphCanvas
          data={data}
          onNodeClick={selectNode}
          selectedNodeId={selectedNode?.id}
          highlightNodeIds={highlightNodeIds.size > 0 ? highlightNodeIds : undefined}
          unsupportedLabels={labels.unsupported}
          onReadyChange={setCanvasReady}
        />
        {canvasReady && (
          <GraphLegend nodes={data.nodes} showHint={!hintSeen} onDismissHint={markHintSeen} labels={labels.legend} />
        )}
      </GraphErrorBoundary>

      <GraphDetailPanel
        node={selectedNode}
        open={panelOpen}
        onClose={closePanel}
        locale={locale}
        labels={labels.panel}
      />
    </div>
  );
}

export { GraphView };
