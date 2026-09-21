import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { DashboardHistoryPoint } from '@/lib/dashboard-schema';

import { PerformanceChart } from '../components/performance-chart';

const HISTORY: DashboardHistoryPoint[] = [
  { at: '2026-09-01T00:00:00Z', nav: '1000', profit: '0', returnPct: '0' },
  { at: '2026-09-02T00:00:00Z', nav: '1010', profit: '10', returnPct: '1' },
  { at: '2026-09-04T00:00:00Z', nav: '1040', profit: '40', returnPct: '4' },
];

describe('PerformanceChart', () => {
  beforeEach(() => {
    const chartBounds = {
      bottom: 360,
      height: 360,
      left: 0,
      right: 640,
      top: 0,
      width: 640,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(chartBounds);
    vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue(chartBounds);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows one explicitly selected metric with an accurately labelled axis', async () => {
    const user = userEvent.setup();
    render(<PerformanceChart history={HISTORY} currency="USD" />);

    expect(screen.getByRole('radio', { name: 'NAV' })).toBeChecked();
    expect(screen.getAllByText('NAV (USD)').length).toBeGreaterThan(0);
    expect(screen.queryByText('수익률 (%)')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '수익률' }));

    expect(screen.getByRole('radio', { name: '수익률' })).toBeChecked();
    expect(screen.getAllByText('수익률 (%)').length).toBeGreaterThan(0);
    expect(screen.queryByText('NAV (USD)')).not.toBeInTheDocument();
  });

  it('lets keyboard users inspect every timestamp with NAV and return values', async () => {
    const user = userEvent.setup();
    render(<PerformanceChart history={HISTORY} currency="USD" />);

    const explorer = screen.getByRole('slider', { name: /성과 시계열 탐색/ });
    explorer.focus();
    expect(explorer).toHaveAttribute('aria-valuemin', '0');
    expect(explorer).toHaveAttribute('aria-valuemax', '2');
    expect(explorer).toHaveAttribute('aria-valuenow', '2');
    expect(screen.getByRole('status')).toHaveTextContent('9월 4일');
    expect(screen.getByRole('status')).toHaveTextContent('NAV $1,040.00');
    expect(screen.getByRole('status')).toHaveTextContent('수익률 +4.00%');

    await user.keyboard('{ArrowLeft}');

    expect(screen.getByRole('status')).toHaveTextContent('9월 2일');
    expect(screen.getByRole('status')).toHaveTextContent('NAV $1,010.00');
    expect(screen.getByRole('status')).toHaveTextContent('수익률 +1.00%');
    expect(explorer).toHaveAttribute('aria-valuenow', '1');

    await user.keyboard('{ArrowDown}');
    expect(explorer).toHaveAttribute('aria-valuenow', '0');
    await user.keyboard('{ArrowUp}');
    expect(explorer).toHaveAttribute('aria-valuenow', '1');
    await user.keyboard('{Home}{End}');
    expect(explorer).toHaveAttribute('aria-valuenow', '2');
  });

  it('shows the timestamp, NAV, and return together on hover', () => {
    render(<PerformanceChart history={HISTORY} currency="USD" />);

    fireEvent.mouseMove(screen.getByRole('slider', { name: /성과 시계열 탐색/ }), {
      clientX: 200,
      clientY: 160,
    });

    expect(screen.getByRole('tooltip')).toHaveTextContent('9월 2일');
    expect(screen.getByRole('tooltip')).toHaveTextContent('NAV');
    expect(screen.getByRole('tooltip')).toHaveTextContent('$1,010.00');
    expect(screen.getByRole('tooltip')).toHaveTextContent('수익률');
    expect(screen.getByRole('tooltip')).toHaveTextContent('+1.00%');
    expect(screen.getByRole('status')).toHaveTextContent('NAV $1,010.00');
  });

  it('explains when NAV and return should share the same trend', () => {
    render(<PerformanceChart history={HISTORY} currency="USD" />);

    expect(screen.getByText(/현금 흐름이 없고 기준점이 고정된 경우.*같은 추세/)).toBeInTheDocument();
  });

  it('renders an empty-state message without chart controls for empty history', () => {
    render(<PerformanceChart history={[]} currency="USD" />);

    expect(screen.getByText('표시할 시계열이 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  it('keeps a single timestamp selectable at the only valid position', async () => {
    const user = userEvent.setup();
    render(<PerformanceChart history={[HISTORY[0]!]} currency="USD" />);

    const explorer = screen.getByRole('slider', { name: /성과 시계열 탐색/ });
    explorer.focus();
    await user.keyboard('{ArrowLeft}{ArrowRight}{Home}{End}');

    expect(explorer).toHaveAttribute('aria-valuemin', '0');
    expect(explorer).toHaveAttribute('aria-valuemax', '0');
    expect(explorer).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByRole('status')).toHaveTextContent('NAV $1,000.00');
  });

  it('reports a null return as unavailable instead of inventing a value', async () => {
    const user = userEvent.setup();
    render(<PerformanceChart history={[{ ...HISTORY[0]!, returnPct: null }]} currency="USD" />);

    expect(screen.getByRole('status')).toHaveTextContent('수익률 산출 불가');
    await user.click(screen.getByRole('radio', { name: '수익률' }));
    expect(screen.getAllByText('수익률 (%)').length).toBeGreaterThan(0);
  });

  it('navigates constant values without implying a calculated change', async () => {
    const user = userEvent.setup();
    const constantHistory = HISTORY.map(point => ({ ...point, nav: '1000', returnPct: '0' }));
    render(<PerformanceChart history={constantHistory} currency="USD" />);

    const explorer = screen.getByRole('slider', { name: /성과 시계열 탐색/ });
    explorer.focus();
    await user.keyboard('{Home}{ArrowRight}');

    expect(explorer).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByRole('status')).toHaveTextContent('NAV $1,000.00');
    expect(screen.getByRole('status')).toHaveTextContent('수익률 0.00%');
  });
});
