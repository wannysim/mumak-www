'use client';

import { XIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useMemo, useRef } from 'react';

import { Button } from '@mumak/ui/components/button';

import { buildLegendEntries } from '../lib/graph-config';
import type { GraphNode } from '../model/types';

interface GraphLegendProps {
  nodes: GraphNode[];
  showHint: boolean;
  onDismissHint: () => void;
  labels: {
    title: string;
    hint: string;
    dismissHint: string;
    sizeNote: string;
    items: Record<string, string>;
  };
}

// 캔버스와 같은 resolveNodeColor로 색을 뽑기 때문에 스와치 색은 데이터다.
// semantic token으로 표현할 수 없어 인라인 style을 쓴다.
function GraphLegend({ nodes, showHint, onDismissHint, labels }: GraphLegendProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const entries = useMemo(() => buildLegendEntries(nodes, isDark), [nodes, isDark]);
  const containerRef = useRef<HTMLElement>(null);

  // 설명할 행이 하나도 없으면(활성 탭 노드 0건) 범례는 빈 껍데기 카드가 된다.
  if (entries.length === 0) {
    return null;
  }

  // 힌트를 닫으면 버튼 노드가 사라져 포커스가 body로 떨어진다(WCAG 2.4.3).
  // 컨테이너로 되돌려 다음 Tab이 문서 최상단이 아니라 범례 다음으로 이어지게 한다.
  const dismissHint = () => {
    onDismissHint();
    containerRef.current?.focus();
  };

  return (
    <aside
      ref={containerRef}
      tabIndex={-1}
      aria-label={labels.title}
      data-slot="graph-legend"
      // 불투명 배경: bg-background/80이면 캔버스 노드가 뒤로 지나갈 때 12px 라벨이
      // AA(4.5:1) 아래로 떨어진다. 400% 확대 시 조상이 overflow-hidden이라 잘린 행에
      // 도달할 수 없으므로 자체 스크롤 경계도 준다.
      className="absolute bottom-16 left-3 z-10 max-h-[calc(100dvh-9rem)] max-w-44 overflow-y-auto rounded-lg border border-border bg-background px-3 py-2.5 outline-none md:bottom-4"
    >
      {showHint && (
        <div className="mb-3 flex items-start gap-2">
          <p className="text-xs text-foreground">{labels.hint}</p>
          <Button
            variant="ghost"
            size="icon"
            // size-8 = 24px 최소치(WCAG 2.5.8)에 여유를 둔 32px. 음수 마진은 광학 정렬용.
            className="-mt-1.5 -mr-1.5 size-8 shrink-0"
            aria-label={labels.dismissHint}
            onClick={dismissHint}
          >
            <XIcon className="size-3.5" />
          </Button>
        </div>
      )}

      <ul className="flex flex-col gap-1.5">
        {entries.map(entry => (
          <li key={entry.key} className="flex items-center gap-2 text-xs text-foreground">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            {labels.items[entry.key] ?? entry.key}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-muted-foreground">{labels.sizeNote}</p>
    </aside>
  );
}

export { GraphLegend };
export type { GraphLegendProps };
