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

  describe('with day and week ranges', () => {
    // 뉴욕 세션 9/18(금), 9/21(월), 9/22(화), 9/28(월). 기본 표시 시간대는 서울이라
    // 20:00Z 마감 기록은 다음 날 05:00으로 보이지만 그 전날 세션에 속한다.
    const SESSIONS: DashboardHistoryPoint[] = [
      ['2026-09-18T13:30:00Z', '1000'],
      ['2026-09-18T20:00:00Z', '1010'],
      ['2026-09-21T13:30:00Z', '1020'],
      ['2026-09-21T20:00:00Z', '1030'],
      ['2026-09-22T13:30:00Z', '1025'],
      ['2026-09-22T20:00:00Z', '1028'],
      ['2026-09-28T13:30:00Z', '1040'],
    ].map(([at, nav]) => ({ at: at!, nav: nav!, profit: '0', returnPct: '0' }));

    let now = 0;
    beforeEach(() => {
      now = 0;
      vi.spyOn(Date, 'now').mockImplementation(() => now);
    });

    function flick(target: HTMLElement, from: { x: number; y?: number }, to: { x: number; y?: number }, ms = 120) {
      fireEvent.touchStart(target, { touches: [{ clientX: from.x, clientY: from.y ?? 100 }] });
      now += ms;
      fireEvent.touchEnd(target, { changedTouches: [{ clientX: to.x, clientY: to.y ?? 100 }] });
    }

    it('opens on the latest trading session and pages through sessions with the buttons', async () => {
      const user = userEvent.setup();
      render(<PerformanceChart history={SESSIONS} currency="USD" baselineNav="1000" range="day" />);
      const range = screen.getByRole('group', { name: '표시 구간' });
      const previous = screen.getByRole('button', { name: '이전 거래일' });
      const next = screen.getByRole('button', { name: '다음 거래일' });

      expect(range).toHaveTextContent('9월 28일 (월)');
      expect(screen.getByRole('slider')).toHaveAttribute('aria-valuemax', '0');
      expect(screen.getByRole('status')).toHaveTextContent('$1,040.00');
      expect(next).toBeDisabled();

      await user.click(previous);
      expect(range).toHaveTextContent('9월 22일 (화)');
      await user.click(previous);
      expect(range).toHaveTextContent('9월 21일 (월)');
      expect(screen.getByRole('slider')).toHaveAttribute('aria-valuemax', '1');
      // 구간을 옮기면 그 구간의 마지막 기록을 선택한다.
      expect(screen.getByRole('status')).toHaveTextContent('$1,030.00');
      expect(screen.getByRole('status')).toHaveTextContent('9월 22일 05:00');
      await user.click(previous);
      expect(range).toHaveTextContent('9월 18일 (금)');
      expect(previous).toBeDisabled();

      await user.click(next);
      expect(range).toHaveTextContent('9월 21일 (월)');
      expect(next).toBeEnabled();
    });

    it('labels a week by its first and last session start dates', async () => {
      const user = userEvent.setup();
      render(<PerformanceChart history={SESSIONS} currency="USD" baselineNav="1000" range="week" />);
      const range = screen.getByRole('group', { name: '표시 구간' });

      expect(range).toHaveTextContent('9월 28일');
      await user.click(screen.getByRole('button', { name: '이전 주' }));
      // 마지막 기록은 서울 기준 9/23 05:00이지만 뉴욕 거래일(9/22)로 적는다.
      expect(range).toHaveTextContent('9월 21일 – 9월 22일');
      expect(screen.getByRole('slider')).toHaveAttribute('aria-valuemax', '3');
      expect(screen.getByRole('status')).toHaveTextContent('$1,028.00');
    });

    it('moves between sessions on a quick horizontal flick, following the finger', () => {
      render(<PerformanceChart history={SESSIONS} currency="USD" baselineNav="1000" range="day" />);
      const explorer = screen.getByRole('slider');
      const range = screen.getByRole('group', { name: '표시 구간' });

      flick(explorer, { x: 300 }, { x: 400 });
      expect(range).toHaveTextContent('9월 22일 (화)');
      expect(screen.getByRole('status')).toHaveTextContent('$1,028.00');

      flick(explorer, { x: 400 }, { x: 300 });
      expect(range).toHaveTextContent('9월 28일 (월)');
    });

    it('keeps slow drags, short moves, and vertical scrolls as scrubbing only', () => {
      render(<PerformanceChart history={SESSIONS} currency="USD" baselineNav="1000" range="day" />);
      const explorer = screen.getByRole('slider');
      const range = screen.getByRole('group', { name: '표시 구간' });

      flick(explorer, { x: 300 }, { x: 500 }, 600);
      flick(explorer, { x: 300 }, { x: 330 });
      flick(explorer, { x: 300, y: 100 }, { x: 360, y: 250 });

      expect(range).toHaveTextContent('9월 28일 (월)');
    });

    it('labels a late-starting session by its market date rather than the viewer date', () => {
      // 19:45Z는 서울 기준 9/19(토) 04:45지만 9/18(금) 세션이다.
      render(
        <PerformanceChart
          history={[{ at: '2026-09-18T19:45:00Z', nav: '1000', profit: '0', returnPct: '0' }]}
          currency="USD"
          baselineNav="1000"
          range="day"
        />
      );
      expect(screen.getByRole('group', { name: '표시 구간' })).toHaveTextContent('9월 18일 (금)');
      expect(screen.getByRole('status')).toHaveTextContent('9월 19일 04:45');
    });

    it('offers no paging in the whole-month view', () => {
      render(<PerformanceChart history={SESSIONS} currency="USD" baselineNav="1000" />);
      const explorer = screen.getByRole('slider');

      expect(screen.queryByRole('button', { name: /이전|다음/ })).not.toBeInTheDocument();
      expect(screen.getByRole('group', { name: '표시 구간' })).toHaveTextContent('9월 18일 – 9월 28일');
      flick(explorer, { x: 300 }, { x: 400 });
      expect(explorer).toHaveAttribute('aria-valuemax', '6');
    });

    it('draws the month-start baseline in a session only when the session reaches it', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <PerformanceChart history={SESSIONS} currency="USD" baselineNav="1025" range="day" />
      );
      const baseline = () => container.querySelector('.baseline-nav .recharts-reference-line-line');

      // 9/28 세션(1040)은 기준선 1025에 닿지 않는다. 축을 넓히면 세션 움직임이 눌린다.
      expect(baseline()).not.toBeInTheDocument();
      expect(screen.queryByText('월 시작 NAV', { exact: false })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: '이전 거래일' }));
      await user.click(screen.getByRole('button', { name: '이전 거래일' }));
      // 9/21 세션(1020~1030)은 기준선을 가로지른다.
      expect(baseline()).toBeInTheDocument();
      expect(screen.getByText('월 시작 NAV', { exact: false })).toHaveTextContent('월 시작 NAV $1,025.00');
    });
  });
});
