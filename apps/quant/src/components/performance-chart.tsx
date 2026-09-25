'use client';

import { useMemo, useState, type MouseEvent, type TouchEvent } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';

import { ChartContainer, type ChartConfig } from '@mumak/ui/components/chart';

import { useTimeZone } from '@/components/time-zone-provider';
import type { DashboardHistoryPoint } from '@/lib/dashboard-schema';
import { formatMoney, formatMoneyCompact, formatPercent, numeric, valueTone } from '@/lib/format';

type DotPosition = { cx?: number; cy?: number; index?: number };

type ChartPoint = DashboardHistoryPoint & {
  index: number;
  navValue: number;
};

// color를 주면 ChartContainer가 --color-navValue를 인라인 <style> 태그로 주입하는데,
// 이 앱의 CSP는 style-src 'self'라 그 태그가 차단된다. 변수가 정의되지 않으면 stroke는
// none, fill은 검정으로 떨어져 선이 통째로 사라진다. label만 남기고 색은 토큰을 직접 쓴다.
const chartConfig = {
  navValue: { label: 'NAV' },
} satisfies ChartConfig;

const LINE_COLOR = 'var(--primary)';
const BASELINE_COLOR = 'var(--muted-foreground)';
const BASELINE_DASH = '6 3';

function PerformanceChart({
  history,
  currency,
  baselineNav,
}: {
  history: DashboardHistoryPoint[];
  currency: string;
  baselineNav: string;
}) {
  const { formatDate, formatDateTime } = useTimeZone();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const points = useMemo<ChartPoint[]>(
    () =>
      history
        .toSorted((left, right) => Date.parse(left.at) - Date.parse(right.at))
        .map((point, index) => ({
          ...point,
          index,
          navValue: numeric(point.nav) ?? 0,
        })),
    [history]
  );
  const first = points[0];
  const last = points.at(-1);

  if (!first || !last) {
    return <p className="py-14 text-center text-sm text-muted-foreground">표시할 시계열이 없습니다.</p>;
  }

  const activeIndex = Math.min(Math.max(selectedIndex ?? points.length - 1, 0), points.length - 1);
  const activePoint = points[activeIndex] ?? last;
  const lineColor = LINE_COLOR;
  const baselineValue = numeric(baselineNav);
  // 점이 많으면 선택 지점만, 적으면 모든 지점을 찍는다. ReferenceDot은 Line보다
  // 아래 레이어에 깔려 선 위의 점에 가려지므로 Line의 dot으로 직접 그린다.
  const showEveryDot = points.length <= 40;

  function renderDot({ cx, cy, index }: DotPosition) {
    if (cx === undefined || cy === undefined) return <></>;
    const selected = index === activeIndex;
    if (!selected && !showEveryDot) return <></>;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={selected ? 5 : 2.5}
        fill={selected ? lineColor : 'var(--background)'}
        stroke={selected ? 'var(--background)' : lineColor}
        strokeWidth={selected ? 2 : 1.5}
        data-selected={selected ? 'true' : undefined}
      />
    );
  }

  function moveSelection(direction: -1 | 1) {
    setSelectedIndex(Math.min(Math.max(activeIndex + direction, 0), points.length - 1));
  }

  function selectAtClientX(clientX: number, container: HTMLElement) {
    const plot = container.querySelector<SVGGraphicsElement>('.recharts-cartesian-grid');
    const bounds = plot?.getBoundingClientRect() ?? container.getBoundingClientRect();
    if (bounds.width <= 0) return;

    const fraction = Math.min(Math.max((clientX - bounds.left) / bounds.width, 0), 1);
    const nextIndex = Math.round(fraction * (points.length - 1));
    setSelectedIndex(nextIndex);
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
      <div
        role="status"
        aria-label="선택 시점 성과"
        aria-live="polite"
        aria-atomic="true"
        className="flex flex-col gap-2"
      >
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">NAV ({currency})</dt>
            <dd className="mt-1 break-all font-mono text-xl font-semibold tabular-nums sm:text-3xl">
              {formatMoney(activePoint.nav, currency)}
            </dd>
          </div>
          <div className="text-right">
            <dt className="text-xs text-muted-foreground">수익률</dt>
            <dd
              className={`mt-1 font-mono text-xl font-semibold tabular-nums sm:text-3xl ${valueTone(activePoint.returnPct)}`}
            >
              {formatPercent(activePoint.returnPct)}
            </dd>
          </div>
        </dl>
        <time dateTime={activePoint.at} className="text-xs text-muted-foreground">
          {formatDateTime(activePoint.at)}
        </time>
      </div>
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
        <ChartContainer config={chartConfig} className="h-60 w-full aspect-auto sm:h-80">
          <LineChart data={points} margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="index"
              type="number"
              domain={[0, Math.max(points.length - 1, 1)]}
              ticks={points
                .filter((point, index) => index === 0 || formatDate(point.at) !== formatDate(points[index - 1]!.at))
                .map(point => point.index)}
              tickFormatter={value => (points[value] ? formatDate(points[value]!.at) : '')}
              minTickGap={32}
              tickMargin={6}
            />
            <YAxis
              dataKey="navValue"
              domain={['auto', 'auto']}
              tickFormatter={value => formatMoneyCompact(Number(value), currency)}
              width={52}
              tickMargin={4}
            />
            {/* 선택 지점을 차트 위에 직접 표시한다. recharts의 자체 hover cursor는
                키보드 탐색 때 나타나지 않아 판독값만 바뀌고 그래프는 그대로였다. */}
            <ReferenceLine
              x={activePoint.index}
              className="selection-guide"
              stroke={lineColor}
              strokeOpacity={0.5}
              strokeDasharray="4 4"
            />
            {/* 월 시작 NAV 기준선. 선이 이보다 위면 이익, 아래면 손실이다. extendDomain이
                없으면 NAV가 한쪽으로만 움직인 달에는 'auto' 축 밖으로 밀려나 선이 사라진다. */}
            {baselineValue !== null && (
              <ReferenceLine
                y={baselineValue}
                ifOverflow="extendDomain"
                className="baseline-nav"
                stroke={BASELINE_COLOR}
                strokeWidth={1}
                strokeDasharray={BASELINE_DASH}
              />
            )}
            <Line
              dataKey="navValue"
              type="linear"
              stroke={lineColor}
              strokeWidth={2}
              connectNulls={false}
              dot={renderDot}
              activeDot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
      </div>
      <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p>
          NAV 추이 · 기록이 없는 시간은 생략 · {formatDateTime(first.at)} — {formatDateTime(last.at)}
        </p>
        {baselineValue !== null && (
          <p className="flex shrink-0 items-center gap-2">
            <svg viewBox="0 0 16 2" className="h-0.5 w-4 shrink-0" aria-hidden="true">
              <line x1="0" y1="1" x2="16" y2="1" stroke={BASELINE_COLOR} strokeWidth={2} strokeDasharray="4 2" />
            </svg>
            <span>
              월 시작 NAV <span className="font-mono tabular-nums">{formatMoney(baselineNav, currency)}</span>
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

export { PerformanceChart };
