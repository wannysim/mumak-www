import { useMemo } from 'react';

import type { DashboardHolding } from '@/lib/dashboard-schema';
import { formatMoney, formatWeight, numeric } from '@/lib/format';
import { buildHoldingsAllocation, type AllocationSlice } from '@/lib/holdings-allocation';

// 이 앱의 CSP는 style-src 'self'라 인라인 style 속성이 차단된다. 색은 CSS 변수를
// SVG presentation attribute(fill/stroke)로 직접 넘겨야 살아남는다. PerformanceChart의
// stroke={'var(--primary)'}와 같은 방식이다.
//
// 색은 목록으로 박아두지 않고 황금각(137.508°)만큼 색상환을 돌며 만든다. 몇 개를 찍든
// 다음 색이 기존 색들 사이의 가장 넓은 빈 곳에 떨어지므로, 종목이 늘어도 슬롯을 손으로
// 늘릴 일이 없다. 명도·채도는 index.css의 토큰에서 받는다.
const BASE_HUE = 264; // --primary와 같은 계열에서 출발한다
const HUE_STEP = 137.508;
// '기타'는 범주가 아니라 접힌 나머지다. 색상환에서 한 칸을 쓰지 않고 중립색으로 둔다.
const FOLDED_COLOR = 'var(--muted-foreground)';

// viewBox 42, r=15.915이면 원주가 정확히 100이라 dasharray 길이가 곧 퍼센트가 된다.
const RADIUS = 15.9155;
const CENTER = 21;
const CIRCUMFERENCE = 100;
// 인접 조각 사이의 표면 간격. 렌더 크기 기준 약 2px.
const SLICE_GAP = 0.5;
const MIN_SLICE_LENGTH = 0.4;

function sliceColor(slice: AllocationSlice, index: number) {
  if (slice.key === 'other') return FOLDED_COLOR;
  const hue = (BASE_HUE + index * HUE_STEP) % 360;
  // 명도를 두 단계로 번갈아 주면 인접 조각의 색각이상 분리도가 눈에 띄게 올라간다.
  const lightness = index % 2 === 0 ? 'var(--chart-lightness-a)' : 'var(--chart-lightness-b)';
  return `oklch(${lightness} var(--chart-chroma) ${hue.toFixed(2)})`;
}

function Swatch({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 8 8" className="size-2.5 shrink-0" aria-hidden="true">
      <rect width="8" height="8" fill={color} />
    </svg>
  );
}

function AllocationDonut({
  holdings,
  currency,
  cash,
  nav,
}: {
  holdings: DashboardHolding[];
  currency: string;
  cash: string;
  nav: string;
}) {
  const allocation = useMemo(() => buildHoldingsAllocation(holdings), [holdings]);
  const { slices, total, omittedSymbols } = allocation;

  if (slices.length === 0) return null;

  const gap = slices.length > 1 ? SLICE_GAP : 0;
  let offset = 0;
  const arcs = slices.map((slice, index) => {
    const length = Math.max(slice.weight * CIRCUMFERENCE - gap, MIN_SLICE_LENGTH);
    const arc = { slice, length, offset, color: sliceColor(slice, index) };
    offset += slice.weight * CIRCUMFERENCE;
    return arc;
  });

  const navValue = numeric(nav);
  const navShare = navValue !== null && navValue > 0 ? total / navValue : null;

  return (
    <div className="grid gap-6 border-b border-border px-4 pb-5 sm:px-6 sm:pb-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:gap-8">
      <figure className="relative mx-auto my-0 size-40 sm:size-44">
        <svg viewBox="0 0 42 42" className="size-full -rotate-90" aria-hidden="true">
          {arcs.map(arc => (
            <circle
              key={arc.slice.key}
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke={arc.color}
              strokeWidth={6}
              strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
              strokeDashoffset={-arc.offset}
            />
          ))}
        </svg>
        <figcaption className="absolute inset-0 grid place-items-center text-center">
          <div>
            <span className="block font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground">
              종목 평가액
            </span>
            <span className="mt-1 block font-mono text-sm font-semibold tabular-nums">
              {formatMoney(String(total), currency)}
            </span>
          </div>
        </figcaption>
      </figure>
      <div className="min-w-0">
        <ul aria-label="보유 종목 평가액 비중" className="grid gap-x-8 lg:grid-cols-2">
          {arcs.map(arc => (
            <li key={arc.slice.key} className="flex items-center gap-2 border-b border-border/60 py-2 text-sm">
              <Swatch color={arc.color} />
              <span className="min-w-0 flex-1 truncate font-mono font-medium">{arc.slice.label}</span>
              <span className="hidden font-mono text-xs text-muted-foreground tabular-nums sm:inline">
                {formatMoney(String(arc.slice.value), currency)}
              </span>
              <span className="w-14 shrink-0 text-right font-mono font-semibold tabular-nums">
                {formatWeight(arc.slice.weight)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          평가액 기준 비중 · 현금 {formatMoney(cash, currency)}
          {navShare !== null && ` · NAV 대비 종목 비중 ${formatWeight(navShare)}`}
        </p>
        {omittedSymbols.length > 0 && (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            평가액이 없어 비중에서 제외: {omittedSymbols.join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}

export { AllocationDonut };
