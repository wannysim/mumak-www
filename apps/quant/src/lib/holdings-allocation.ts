import type { DashboardHolding } from '@/lib/dashboard-schema';
import { numeric } from '@/lib/format';

// 색이 아니라 가독성이 정하는 상한. 색은 필요한 만큼 생성되지만(allocation-donut 참조),
// 조각이 이보다 많아지면 도넛도 범례도 한눈에 읽히지 않는다. 넘치는 꼬리는 '기타'로 접는다.
const MAX_SLICES = 10;

type AllocationSlice = {
  key: string;
  label: string;
  symbols: string[];
  value: number;
  weight: number;
};

type HoldingsAllocation = {
  slices: AllocationSlice[];
  total: number;
  // 평가액이 없거나 0 이하라 비중을 계산할 수 없는 종목. 조용히 버리지 않고 화면에 남긴다.
  omittedSymbols: string[];
};

function buildHoldingsAllocation(holdings: DashboardHolding[]): HoldingsAllocation {
  const valued: { symbol: string; value: number }[] = [];
  const omittedSymbols: string[] = [];

  for (const holding of holdings) {
    const value = numeric(holding.marketValue);
    if (value === null || value <= 0) omittedSymbols.push(holding.symbol);
    else valued.push({ symbol: holding.symbol, value });
  }

  const total = valued.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return { slices: [], total: 0, omittedSymbols };

  const ranked = valued.toSorted((left, right) => right.value - left.value || left.symbol.localeCompare(right.symbol));
  const named = ranked.length > MAX_SLICES ? ranked.slice(0, MAX_SLICES - 1) : ranked;
  const folded = ranked.slice(named.length);

  const slices: AllocationSlice[] = named.map(item => ({
    key: item.symbol,
    label: item.symbol,
    symbols: [item.symbol],
    value: item.value,
    weight: item.value / total,
  }));

  if (folded.length > 0) {
    const value = folded.reduce((sum, item) => sum + item.value, 0);
    slices.push({
      key: 'other',
      label: `기타 ${folded.length}종목`,
      symbols: folded.map(item => item.symbol),
      value,
      weight: value / total,
    });
  }

  return { slices, total, omittedSymbols };
}

export { buildHoldingsAllocation, MAX_SLICES, type AllocationSlice, type HoldingsAllocation };
