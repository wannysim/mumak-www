import { render, screen, within } from '@testing-library/react';

import { AllocationDonut } from '@/components/allocation-donut';
import type { DashboardHolding } from '@/lib/dashboard-schema';

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

function renderDonut(holdings: DashboardHolding[], { cash = '0', nav = '0' } = {}) {
  return render(<AllocationDonut holdings={holdings} currency="USD" cash={cash} nav={nav} />);
}

it('labels every slice in the legend so weight never rides on color alone', () => {
  renderDonut([holding('AAA', '7500'), holding('BBB', '2500')]);

  const rows = within(screen.getByRole('list', { name: '보유 종목 평가액 비중' })).getAllByRole('listitem');
  expect(rows.map(row => row.textContent)).toEqual(['AAA$7,500.0075.0%', 'BBB$2,500.0025.0%']);
});

it('draws one arc per slice with a resolvable stroke token', () => {
  const { container } = renderDonut([holding('AAA', '7500'), holding('BBB', '2500')]);

  const arcs = [...container.querySelectorAll('circle')];
  // 색은 목록이 아니라 황금각 회전으로 만들어진다. 명도는 두 단계를 번갈아 쓴다.
  expect(arcs.map(arc => arc.getAttribute('stroke'))).toEqual([
    'oklch(var(--chart-lightness-a) var(--chart-chroma) 264.00)',
    'oklch(var(--chart-lightness-b) var(--chart-chroma) 41.51)',
  ]);
  // dasharray 길이가 곧 비중(원주 100). 조각 사이 간격만큼만 짧다.
  expect(arcs.map(arc => arc.getAttribute('stroke-dasharray'))).toEqual(['74.5 25.5', '24.5 75.5']);
  expect(arcs.map(arc => arc.getAttribute('stroke-dashoffset'))).toEqual(['0', '-75']);
});

it('keeps a single holding as a full ring without a phantom gap', () => {
  const { container } = renderDonut([holding('ONLY', '1000')]);

  const arc = container.querySelector('circle')!;
  expect(arc.getAttribute('stroke-dasharray')).toBe('100 0');
  expect(screen.getByText('100.0%')).toBeInTheDocument();
});

it('shows the cash and NAV context the holdings-only denominator leaves out', () => {
  renderDonut([holding('AAA', '8000')], { cash: '2000', nav: '10000' });

  expect(screen.getByText(/현금 \$2,000\.00 · NAV 대비 종목 비중 80\.0%/)).toBeInTheDocument();
});

it('keeps generating distinct hues past the old fixed slot count', () => {
  const holdings = Array.from({ length: 9 }, (_, index) => holding(`S${index}`, String(100 - index)));
  const { container } = renderDonut(holdings);

  const strokes = [...container.querySelectorAll('circle')].map(arc => arc.getAttribute('stroke'));
  expect(strokes).toHaveLength(9);
  expect(new Set(strokes).size).toBe(9);
  for (const stroke of strokes) expect(stroke).toMatch(/^oklch\(var\(--chart-lightness-[ab]\) var\(--chart-chroma\) /);
});

it('folds past the readability cap and paints the remainder neutral', () => {
  const holdings = Array.from({ length: 14 }, (_, index) => holding(`S${index}`, String(100 - index)));
  const { container } = renderDonut(holdings);

  const strokes = [...container.querySelectorAll('circle')].map(arc => arc.getAttribute('stroke'));
  expect(strokes).toHaveLength(10);
  expect(strokes.at(-1)).toBe('var(--muted-foreground)');
  expect(screen.getByText('기타 5종목')).toBeInTheDocument();
});

it('names the holdings it could not weight', () => {
  renderDonut([holding('AAA', '100'), holding('NOPRICE', null)]);

  expect(screen.getByText('평가액이 없어 비중에서 제외: NOPRICE')).toBeInTheDocument();
});

it('renders nothing when no holding can be weighted', () => {
  const { container } = renderDonut([holding('NOPRICE', null)]);
  expect(container).toBeEmptyDOMElement();
});
