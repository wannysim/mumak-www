import type { NoteStatus } from '@/src/entities/note';

import type { GraphNode, GraphNodeType } from '../model/types';

export const NODE_BASE_SIZE = 4;
export const NODE_SIZE_SCALE = 1.5;
export const TAG_NODE_SIZE = 2;
export const CATEGORY_NODE_SIZE = 3;

export function getNodeSize(type: GraphNodeType, linkCount: number): number {
  if (type === 'tag') return TAG_NODE_SIZE;
  if (type === 'category') return CATEGORY_NODE_SIZE;
  return NODE_BASE_SIZE + linkCount * NODE_SIZE_SCALE;
}

const STATUS_COLORS: Record<NoteStatus, { light: string; dark: string }> = {
  seedling: { light: '#2f9e44', dark: '#51cf66' },
  // 라이트 앰버(#e8a317)는 흰 배경 대비 2.17:1이라 비텍스트 최소치(3:1)에 미달했다.
  // 8px 스와치가 색-라벨 매핑의 유일한 전달 수단이므로 명도를 내려 3.82:1로 맞춘다.
  budding: { light: '#a67c00', dark: '#fcc419' },
  evergreen: { light: '#1098ad', dark: '#3bc9db' },
};

const CATEGORY_COLORS: Record<string, { light: string; dark: string }> = {
  essay: { light: '#d9480f', dark: '#ff922b' },
  articles: { light: '#7048e8', dark: '#9775fa' },
  // notes는 예전에 fallback 중성 회색을 그대로 썼다. 범례가 생기면서 태그 노드
  // 회색과 사실상 구분되지 않는 행 두 개가 되므로 고유 색조를 부여한다.
  notes: { light: '#1c7ed6', dark: '#4dabf7' },
};

const FALLBACK_COLOR = { light: '#868e96', dark: '#adb5bd' };

export function getNoteColor(status: NoteStatus, isDark: boolean): string {
  const palette = STATUS_COLORS[status] ?? FALLBACK_COLOR;
  return isDark ? palette.dark : palette.light;
}

export function getPostColor(category: string, isDark: boolean): string {
  const palette = CATEGORY_COLORS[category] ?? FALLBACK_COLOR;
  return isDark ? palette.dark : palette.light;
}

// 태그는 구조 노드라 중성 회색을 유지하되 명암 방향을 배경에 맞춘다.
// (이전에는 라이트에 밝은 회색, 다크에 어두운 회색이 나가 양쪽 다 배경에 묻혔다.)
export function getTagColor(isDark: boolean): string {
  return isDark ? '#adb5bd' : '#868e96';
}

// 카테고리 허브 노드. 예전 앰버는 다크에서 essay 오렌지와 구분되지 않았다.
export function getCategoryColor(isDark: boolean): string {
  return isDark ? '#f06595' : '#d6336c';
}

// 노드 타입 → 색상 매핑. 새 타입이 추가되면 이 맵에 한 줄만 더하면 되고
// 색을 소비하는 쪽(graph-canvas)은 수정하지 않는다.
const NODE_COLOR: Record<GraphNodeType, (node: GraphNode, isDark: boolean) => string> = {
  note: (node, isDark) => getNoteColor(node.status ?? 'seedling', isDark),
  post: (node, isDark) => getPostColor(node.category ?? 'notes', isDark),
  tag: (_node, isDark) => getTagColor(isDark),
  category: (_node, isDark) => getCategoryColor(isDark),
};

export function resolveNodeColor(node: GraphNode, isDark: boolean): string {
  return (NODE_COLOR[node.type] ?? NODE_COLOR.tag)(node, isDark);
}

export function getLinkColor(isDark: boolean): string {
  return isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
}

export function getBackgroundColor(isDark: boolean): string {
  return isDark ? '#0a0a0a' : '#ffffff';
}

export const FORCE_CONFIG = {
  linkDistance: 50,
  chargeStrength: -80,
  centerStrength: 0.05,
} as const;

export interface GraphLegendEntry {
  /** 'status:seedling' | 'category:essay' | 'type:tag' | 'type:category' */
  key: string;
  color: string;
}

// 행 순서만 고정한다(성장 단계 → 블로그 분류 → 구조 노드).
// 목록에 없는 키도 뒤에 붙으므로 멤버십은 언제나 데이터가 결정한다.
const LEGEND_ORDER = [
  'status:seedling',
  'status:budding',
  'status:evergreen',
  'category:essay',
  'category:articles',
  'category:notes',
  'type:category',
  'type:tag',
];

// resolveNodeColor의 폴백(seedling / notes)과 반드시 같아야 한다.
// 어긋나면 색은 A인데 라벨은 B인 조용한 drift가 된다.
function legendKeyOf(node: GraphNode): string {
  if (node.type === 'note') return `status:${node.status ?? 'seedling'}`;
  if (node.type === 'post') return `category:${node.category ?? 'notes'}`;
  return `type:${node.type}`;
}

// 범례는 실제 렌더된 노드에서 파생한다. 색을 캔버스와 같은 resolveNodeColor로
// 뽑으므로 어긋날 수 없고, 0건인 status(현재 evergreen)는 행이 생기지 않는다.
export function buildLegendEntries(nodes: GraphNode[], isDark: boolean): GraphLegendEntry[] {
  const byKey = new Map<string, string>();

  for (const node of nodes) {
    const key = legendKeyOf(node);
    if (!byKey.has(key)) byKey.set(key, resolveNodeColor(node, isDark));
  }

  const rank = (key: string) => {
    const index = LEGEND_ORDER.indexOf(key);
    return index === -1 ? LEGEND_ORDER.length : index;
  };

  return [...byKey].map(([key, color]) => ({ key, color })).toSorted((a, b) => rank(a.key) - rank(b.key));
}
