import type { DashboardHolding } from '@/lib/dashboard-schema';
import { buildHoldingsAllocation, MAX_SLICES } from '@/lib/holdings-allocation';

function holding(symbol: string, marketValue: string | null): DashboardHolding {
  return {
    symbol,
    quantity: '1',
    averageCost: '1',
    markPrice: marketValue,
    markAsOf: null,
    marketValue,
    unrealizedPnl: null,
    returnPct: null,
  };
}

describe('buildHoldingsAllocation', () => {
  it('ranks holdings by market value and weights them against the holdings total', () => {
    const { slices, total, omittedSymbols } = buildHoldingsAllocation([holding('A', '2500'), holding('B', '7500')]);

    expect(total).toBe(10000);
    expect(omittedSymbols).toEqual([]);
    expect(slices.map(slice => [slice.label, slice.weight])).toEqual([
      ['B', 0.75],
      ['A', 0.25],
    ]);
  });

  it('folds the tail into one 기타 slice once the readable slice count is exceeded', () => {
    const holdings = Array.from({ length: MAX_SLICES + 3 }, (_, index) => holding(`S${index}`, String(100 - index)));

    const { slices } = buildHoldingsAllocation(holdings);

    expect(slices).toHaveLength(MAX_SLICES);
    expect(slices.slice(0, MAX_SLICES - 1).map(slice => slice.label)).toEqual(
      Array.from({ length: MAX_SLICES - 1 }, (_, index) => `S${index}`)
    );
    const folded = slices.at(-1)!;
    expect(folded.key).toBe('other');
    expect(folded.label).toBe('기타 4종목');
    expect(folded.symbols).toEqual(['S9', 'S10', 'S11', 'S12']);
    // 접힌 조각도 남은 평가액을 그대로 들고 있어야 비중 합이 100%가 된다.
    expect(slices.reduce((sum, slice) => sum + slice.weight, 0)).toBeCloseTo(1, 10);
  });

  it('reports holdings without a usable market value instead of dropping them silently', () => {
    const { slices, total, omittedSymbols } = buildHoldingsAllocation([
      holding('PRICED', '400'),
      holding('UNPRICED', null),
      holding('ZERO', '0'),
    ]);

    expect(slices.map(slice => slice.label)).toEqual(['PRICED']);
    expect(total).toBe(400);
    expect(omittedSymbols).toEqual(['UNPRICED', 'ZERO']);
  });

  it('produces no slices when nothing can be weighted', () => {
    expect(buildHoldingsAllocation([])).toEqual({ slices: [], total: 0, omittedSymbols: [] });
    expect(buildHoldingsAllocation([holding('X', null)]).slices).toEqual([]);
  });
});
