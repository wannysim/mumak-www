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

  it('shows the latest NAV and return together without switching metrics', () => {
    render(<PerformanceChart history={HISTORY} currency="USD" baselineNav="1000" />);
    const readout = screen.getByRole('status', { name: '선택 시점 성과' });
    expect(readout).toHaveTextContent('NAV (USD)');
    expect(readout).toHaveTextContent('$1,040.00');
    expect(readout).toHaveTextContent('수익률');
    expect(readout).toHaveTextContent('+4.00%');
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('lets keyboard users inspect every timestamp with NAV and return values', async () => {
    const user = userEvent.setup();
    render(<PerformanceChart history={HISTORY} currency="USD" baselineNav="1000" />);

    const explorer = screen.getByRole('slider', { name: /성과 시계열 탐색/ });
    explorer.focus();
    expect(explorer).toHaveAttribute('aria-valuemin', '0');
    expect(explorer).toHaveAttribute('aria-valuemax', '2');
    expect(explorer).toHaveAttribute('aria-valuenow', '2');
    expect(screen.getByRole('status')).toHaveTextContent('9월 4일');
    expect(screen.getByRole('status')).toHaveTextContent('$1,040.00');
    expect(screen.getByRole('status')).toHaveTextContent('+4.00%');

    await user.keyboard('{ArrowLeft}');

    expect(screen.getByRole('status')).toHaveTextContent('9월 2일');
    expect(screen.getByRole('status')).toHaveTextContent('$1,010.00');
    expect(screen.getByRole('status')).toHaveTextContent('+1.00%');
    expect(explorer).toHaveAttribute('aria-valuenow', '1');

    await user.keyboard('{ArrowDown}');
    expect(explorer).toHaveAttribute('aria-valuenow', '0');
    await user.keyboard('{ArrowUp}');
    expect(explorer).toHaveAttribute('aria-valuenow', '1');
    await user.keyboard('{Home}{End}');
    expect(explorer).toHaveAttribute('aria-valuenow', '2');
  });

  it('updates the fixed readout on hover without covering the plot', () => {
    render(<PerformanceChart history={HISTORY} currency="USD" baselineNav="1000" />);

    fireEvent.mouseMove(screen.getByRole('slider', { name: /성과 시계열 탐색/ }), {
      clientX: 200,
      clientY: 160,
    });

    expect(screen.getByRole('status')).toHaveTextContent('9월 2일');
    expect(screen.getByRole('status')).toHaveTextContent('NAV');
    expect(screen.getByRole('status')).toHaveTextContent('$1,010.00');
    expect(screen.getByRole('status')).toHaveTextContent('수익률');
    expect(screen.getByRole('status')).toHaveTextContent('+1.00%');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('preserves recorded returns instead of deriving them from the first visible NAV', async () => {
    const user = userEvent.setup();
    const history = HISTORY.map((point, index) => ({ ...point, returnPct: index === 1 ? '-2.5' : '7.25' }));
    render(<PerformanceChart history={history} currency="USD" baselineNav="1000" />);
    const explorer = screen.getByRole('slider');
    explorer.focus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('status')).toHaveTextContent('7.25%');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('status')).toHaveTextContent('$1,010.00');
    expect(screen.getByRole('status')).toHaveTextContent('-2.50%');
    expect(explorer).toHaveAttribute('aria-valuetext', expect.stringContaining('수익률 -2.50%'));
  });

  it('renders an empty-state message without chart controls for empty history', () => {
    render(<PerformanceChart history={[]} currency="USD" baselineNav="1000" />);

    expect(screen.getByText('표시할 시계열이 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  it('keeps a single timestamp selectable at the only valid position', async () => {
    const user = userEvent.setup();
    render(<PerformanceChart history={[HISTORY[0]!]} currency="USD" baselineNav="1000" />);

    const explorer = screen.getByRole('slider', { name: /성과 시계열 탐색/ });
    explorer.focus();
    await user.keyboard('{ArrowLeft}{ArrowRight}{Home}{End}');

    expect(explorer).toHaveAttribute('aria-valuemin', '0');
    expect(explorer).toHaveAttribute('aria-valuemax', '0');
    expect(explorer).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByRole('status')).toHaveTextContent('$1,000.00');
  });

  it('reports a null return as unavailable instead of inventing a value', () => {
    render(<PerformanceChart history={[{ ...HISTORY[0]!, returnPct: null }]} currency="USD" baselineNav="1000" />);

    expect(screen.getByRole('status')).toHaveTextContent('산출 불가');
    expect(screen.getByRole('status')).toHaveTextContent('$1,000.00');
  });

  it('navigates constant values without implying a calculated change', async () => {
    const user = userEvent.setup();
    const constantHistory = HISTORY.map(point => ({ ...point, nav: '1000', returnPct: '0' }));
    render(<PerformanceChart history={constantHistory} currency="USD" baselineNav="1000" />);

    const explorer = screen.getByRole('slider', { name: /성과 시계열 탐색/ });
    explorer.focus();
    await user.keyboard('{Home}{ArrowRight}');

    expect(explorer).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByRole('status')).toHaveTextContent('$1,000.00');
    expect(screen.getByRole('status')).toHaveTextContent('0.00%');
  });

  it('selects observations equally across a weekend for mouse and touch', () => {
    const history = [
      '2026-09-18T19:45:00Z',
      '2026-09-18T20:00:00Z',
      '2026-09-21T13:30:00Z',
      '2026-09-21T13:45:00Z',
    ].map((at, index) => ({ at, nav: String(1000 + index), profit: String(index), returnPct: '0' }));
    render(<PerformanceChart history={history.toReversed()} currency="USD" baselineNav="1000" />);
    const explorer = screen.getByRole('slider');
    fireEvent.mouseMove(explorer, { clientX: 640 / 3 });
    expect(explorer).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByRole('status')).toHaveTextContent('$1,001.00');
    fireEvent.touchStart(explorer, { touches: [{ clientX: 1280 / 3 }] });
    expect(explorer).toHaveAttribute('aria-valuenow', '2');
    expect(screen.getByRole('status')).toHaveTextContent('$1,002.00');
  });

  it('draws the month-start NAV as a baseline and names it in the legend', () => {
    const { container } = render(<PerformanceChart history={HISTORY} currency="USD" baselineNav="1020" />);

    expect(container.querySelector('.baseline-nav .recharts-reference-line-line')).toBeInTheDocument();
    expect(screen.getByText('월 시작 NAV', { exact: false })).toHaveTextContent('월 시작 NAV $1,020.00');
  });

  it('keeps the baseline visible when every NAV stays on one side of it', () => {
    const { container } = render(<PerformanceChart history={HISTORY} currency="USD" baselineNav="900" />);

    // 'auto' 축은 데이터 범위(1000~1040)만 잡고, 기본 ifOverflow='discard'는 범위 밖 선을 버린다.
    // extendDomain이 축을 900까지 넓혀야 선이 남는다.
    expect(container.querySelector('.baseline-nav .recharts-reference-line-line')).toBeInTheDocument();
  });

  it('follows the latest observation when new data arrives before user selection', () => {
    const { rerender } = render(<PerformanceChart history={HISTORY.slice(0, 2)} currency="USD" baselineNav="1000" />);
    rerender(<PerformanceChart history={HISTORY} currency="USD" baselineNav="1000" />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '2');
  });
});
