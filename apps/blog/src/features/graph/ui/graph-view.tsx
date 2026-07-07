'use client';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Component, useCallback, useMemo, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

import type { GraphData, GraphNode, GraphTab } from '../model/types';
import { GraphControls } from './graph-controls';
import { GraphDetailPanel } from './graph-detail-panel';
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
      search: string;
      filter: string;
      clearFilters: string;
      noResults: string;
      status: string;
      tags: string;
      categories: string;
    };
    panel: {
      viewDetail: string;
      connections: string;
      type: Record<string, string>;
      status: Record<string, string>;
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

function buildHighlightIds(data: GraphData, filters: string[], searchQuery: string): Set<string> {
  const ids = new Set<string>();
  const query = searchQuery.toLowerCase();
  const tagFilters = filters.filter(f => f.startsWith('tag:'));
  const nonTagFilters = filters.filter(f => !f.startsWith('tag:'));
  const tagMatchIds = new Set<string>();

  // 검색·필터·태그 매칭을 노드 리스트 한 번의 순회로 모두 수집한다.
  for (const node of data.nodes) {
    if (searchQuery && node.name.toLowerCase().includes(query)) ids.add(node.id);
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

function GraphView({ gardenData, blogData, locale, labels }: GraphViewProps) {
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get('tab') as GraphTab) || 'garden';
  const data = activeTab === 'garden' ? gardenData : blogData;

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const toggleFilter = useCallback((filter: string) => {
    setActiveFilters(prev => (prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]));
  }, []);

  const clearFilters = useCallback(() => setActiveFilters([]), []);

  const selectNode = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    setPanelOpen(true);
  }, []);

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
      <GraphToolbar locale={locale} />

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
      />

      <GraphErrorBoundary labels={labels.error}>
        <GraphCanvas
          data={data}
          onNodeClick={selectNode}
          selectedNodeId={selectedNode?.id}
          highlightNodeIds={highlightNodeIds.size > 0 ? highlightNodeIds : undefined}
          unsupportedLabels={labels.unsupported}
        />
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
