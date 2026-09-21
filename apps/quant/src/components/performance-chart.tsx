import { useId } from 'react';

import type { DashboardHistoryPoint } from '@/lib/dashboard-schema';
import { formatDateTime, formatMoney, formatPercent, numeric } from '@/lib/format';

const WIDTH = 720;
const HEIGHT = 260;
const PADDING_X = 36;
const PADDING_Y = 30;

function coordinates(values: number[]) {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  return values.map((value, index) => ({
    x: PADDING_X + (index / Math.max(values.length - 1, 1)) * (WIDTH - PADDING_X * 2),
    y: HEIGHT - PADDING_Y - ((value - minimum) / range) * (HEIGHT - PADDING_Y * 2),
  }));
}

function linePath(points: Array<{ x: number; y: number }>) {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
}

function PerformanceChart({ history, currency }: { history: DashboardHistoryPoint[]; currency: string }) {
  const titleId = useId();
  const descriptionId = useId();
  const points = history.toSorted((left, right) => Date.parse(left.at) - Date.parse(right.at));
  const navPoints = coordinates(points.map(point => numeric(point.nav) ?? 0));
  const returnValues = points.map(point => numeric(point.returnPct)).filter((value): value is number => value !== null);
  const returnPoints = returnValues.length === points.length ? coordinates(returnValues) : [];
  const first = points[0];
  const last = points.at(-1);

  if (!first || !last) {
    return <p className="py-14 text-center text-sm text-muted-foreground">표시할 시계열이 없습니다.</p>;
  }

  return (
    <div className="min-w-0">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto min-h-52 w-full overflow-visible"
        role="img"
        aria-labelledby={`${titleId} ${descriptionId}`}
      >
        <title id={titleId}>NAV 및 수익률 추이</title>
        <desc id={descriptionId}>
          {formatDateTime(first.at)}부터 {formatDateTime(last.at)}까지 NAV {formatMoney(first.nav, currency)}에서{' '}
          {formatMoney(last.nav, currency)}, 수익률 {formatPercent(last.returnPct)}
        </desc>
        {[0, 1, 2, 3, 4].map(line => {
          const y = PADDING_Y + (line / 4) * (HEIGHT - PADDING_Y * 2);
          return <line key={line} x1={PADDING_X} x2={WIDTH - PADDING_X} y1={y} y2={y} className="chart-grid" />;
        })}
        <path d={linePath(navPoints)} className="chart-nav" vectorEffect="non-scaling-stroke" />
        {returnPoints.length > 0 && (
          <path d={linePath(returnPoints)} className="chart-return" vectorEffect="non-scaling-stroke" />
        )}
        {navPoints.map((point, index) => (
          <circle key={points[index]?.at} cx={point.x} cy={point.y} r="3" className="chart-point">
            <title>
              {formatDateTime(points[index]?.at ?? '')}: NAV {formatMoney(points[index]?.nav ?? null, currency)},{' '}
              {formatPercent(points[index]?.returnPct ?? null)}
            </title>
          </circle>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground" aria-hidden="true">
        <span className="flex items-center gap-2">
          <i className="block h-0.5 w-5 bg-primary" />
          NAV
        </span>
        {returnPoints.length > 0 && (
          <span className="flex items-center gap-2">
            <i className="chart-return-key block h-0.5 w-5" />
            수익률
          </span>
        )}
        <span className="ml-auto font-mono tabular-nums">
          {formatDateTime(first.at)} — {formatDateTime(last.at)}
        </span>
      </div>
    </div>
  );
}

export { PerformanceChart };
