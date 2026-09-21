'use client';

import { useMemo, useState, type MouseEvent, type TouchEvent } from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

import { ChartContainer, ChartTooltip, type ChartConfig } from '@mumak/ui/components/chart';
import { ToggleGroup, ToggleGroupItem } from '@mumak/ui/components/toggle-group';

import type { DashboardHistoryPoint } from '@/lib/dashboard-schema';
import { formatDateTime, formatMoney, formatPercent, numeric } from '@/lib/format';

type Metric = 'nav' | 'returnPct';

type ChartPoint = DashboardHistoryPoint & {
  timestamp: number;
  navValue: number;
  returnValue: number | null;
};

const chartConfig = {
  navValue: { label: 'NAV', color: 'var(--primary)' },
  returnValue: { label: '수익률', color: 'var(--primary)' },
} satisfies ChartConfig;

function PerformanceChart({ history, currency }: { history: DashboardHistoryPoint[]; currency: string }) {
  const [metric, setMetric] = useState<Metric>('nav');
  const [selectedIndex, setSelectedIndex] = useState(history.length - 1);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const points = useMemo<ChartPoint[]>(
    () =>
      history
        .toSorted((left, right) => Date.parse(left.at) - Date.parse(right.at))
        .map(point => ({
          ...point,
          timestamp: Date.parse(point.at),
          navValue: numeric(point.nav) ?? 0,
          returnValue: numeric(point.returnPct),
        })),
    [history]
  );
  const first = points[0];
  const last = points.at(-1);

  if (!first || !last) {
    return <p className="py-14 text-center text-sm text-muted-foreground">표시할 시계열이 없습니다.</p>;
  }

  const startPoint = first;
  const endPoint = last;
  const selectedDataKey = metric === 'nav' ? 'navValue' : 'returnValue';
  const yAxisLabel = metric === 'nav' ? `NAV (${currency})` : '수익률 (%)';
  const activeIndex = Math.min(Math.max(selectedIndex, 0), points.length - 1);
  const activePoint = points[activeIndex] ?? endPoint;

  function moveSelection(direction: -1 | 1) {
    setSelectedIndex(current => Math.min(Math.max(current + direction, 0), points.length - 1));
  }

  function selectAtClientX(clientX: number, container: HTMLElement) {
    const plot = container.querySelector<SVGGraphicsElement>('.recharts-cartesian-grid');
    const bounds = plot?.getBoundingClientRect() ?? container.getBoundingClientRect();
    if (bounds.width <= 0) return;

    const fraction = Math.min(Math.max((clientX - bounds.left) / bounds.width, 0), 1);
    const targetTimestamp = startPoint.timestamp + fraction * (endPoint.timestamp - startPoint.timestamp);
    const nextIndex = points.reduce(
      (closest, point, index) =>
        Math.abs(point.timestamp - targetTimestamp) < Math.abs(points[closest]!.timestamp - targetTimestamp)
          ? index
          : closest,
      0
    );
    setSelectedIndex(nextIndex);
    setIsTooltipVisible(true);
  }

  function handleMouseMove(event: MouseEvent<HTMLDivElement>) {
    selectAtClientX(event.clientX, event.currentTarget);
  }

  function handleTouch(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0] ?? event.changedTouches[0];
    if (touch) selectAtClientX(touch.clientX, event.currentTarget);
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ToggleGroup
        type="single"
        value={metric}
        onValueChange={value => value && setMetric(value as Metric)}
        variant="outline"
        size="sm"
        aria-label="차트 지표"
      >
        <ToggleGroupItem value="nav" aria-label="NAV">
          NAV
        </ToggleGroupItem>
        <ToggleGroupItem value="returnPct" aria-label="수익률">
          수익률
        </ToggleGroupItem>
      </ToggleGroup>
      <p className="text-xs font-medium">{yAxisLabel}</p>
      <span
        role="img"
        className="sr-only"
        aria-label={`NAV 및 수익률 추이. ${formatDateTime(first.at)}부터 ${formatDateTime(last.at)}까지 NAV ${formatMoney(first.nav, currency)}에서 ${formatMoney(last.nav, currency)}, 수익률 ${formatPercent(last.returnPct)}`}
      />
      <div
        role="slider"
        tabIndex={0}
        aria-label="성과 시계열 탐색. 좌우 화살표로 시점을 이동합니다."
        aria-valuemin={0}
        aria-valuemax={points.length - 1}
        aria-valuenow={activeIndex}
        aria-valuetext={`${formatDateTime(activePoint.at)}, NAV ${formatMoney(activePoint.nav, currency)}, 수익률 ${formatPercent(activePoint.returnPct)}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setIsTooltipVisible(false)}
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        onKeyDown={event => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
            event.preventDefault();
            moveSelection(-1);
          } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            event.preventDefault();
            moveSelection(1);
          } else if (event.key === 'Home') {
            event.preventDefault();
            setSelectedIndex(0);
          } else if (event.key === 'End') {
            event.preventDefault();
            setSelectedIndex(points.length - 1);
          }
        }}
        className="relative rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChartContainer config={chartConfig} className="min-h-52 w-full">
          <LineChart data={points} margin={{ top: 12, right: 12, bottom: 24, left: 24 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={value => formatDateTime(new Date(value).toISOString())}
              minTickGap={32}
            />
            <YAxis
              dataKey={selectedDataKey}
              domain={['auto', 'auto']}
              tickFormatter={value =>
                metric === 'nav' ? formatMoney(String(value), currency) : `${Number(value).toLocaleString('ko-KR')}%`
              }
              width={84}
              label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
            />
            <ChartTooltip cursor content={() => null} />
            <Line
              dataKey={selectedDataKey}
              type="linear"
              stroke={`var(--color-${selectedDataKey})`}
              strokeWidth={2}
              connectNulls={false}
              dot={points.length === 1}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
        {isTooltipVisible && (
          <div
            role="tooltip"
            className="pointer-events-none absolute left-2 top-2 z-10 grid min-w-40 gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl"
          >
            <p className="font-medium">{formatDateTime(activePoint.at)}</p>
            <p>NAV {formatMoney(activePoint.nav, currency)}</p>
            <p>수익률 {formatPercent(activePoint.returnPct)}</p>
          </div>
        )}
        <p role="status" aria-live="polite" className="px-2 pb-2 text-xs font-medium tabular-nums">
          {formatDateTime(activePoint.at)} · NAV {formatMoney(activePoint.nav, currency)} · 수익률{' '}
          {formatPercent(activePoint.returnPct)}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        {formatDateTime(first.at)} — {formatDateTime(last.at)}
      </p>
      <p className="text-xs text-muted-foreground">
        현금 흐름이 없고 기준점이 고정된 경우 NAV와 수익률은 같은 추세를 보입니다. 값과 단위가 같다는 뜻은 아닙니다.
      </p>
    </div>
  );
}

export { PerformanceChart };
