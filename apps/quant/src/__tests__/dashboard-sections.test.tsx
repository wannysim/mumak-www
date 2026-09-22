import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SnapshotDashboard } from '@/components/dashboard-sections';
import { parseSnapshotPayload } from '@/lib/dashboard-schema';

import { TEST_ONLY_PAPER_PAYLOAD } from './fixtures/test-snapshot';

vi.mock('@/components/performance-chart', () => ({ PerformanceChart: () => null }));

function snapshot() {
  const data = parseSnapshotPayload(structuredClone(TEST_ONLY_PAPER_PAYLOAD));
  data.holdings[0]!.symbol = 'AMD';
  data.fills[0]!.symbol = 'AMD';
  // Empty history keeps these tests focused on holdings/fills rather than SVG layout.
  data.history = [];
  return data;
}

it('opens the recorded decision reason by click and closes with Escape', async () => {
  const user = userEvent.setup();
  const data = snapshot();
  data.fills = data.fills.map(fill => ({ ...fill, reason: '정기 리밸런싱' }));
  render(<SnapshotDashboard snapshot={data} />);
  const trigger = screen.getAllByRole('button', { name: 'AMD 매수 체결 상세' })[0]!;
  await user.click(trigger);
  expect(await screen.findByRole('dialog', { name: 'AMD 매수 체결 상세' })).toHaveTextContent('정기 리밸런싱');
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it('keeps absent historical reasons blank instead of inventing an explanation', () => {
  render(<SnapshotDashboard snapshot={snapshot()} />);
  expect(screen.getAllByRole('button', { name: /체결 상세/ })).toHaveLength(2);
});

it('shows the recorded reason on pointer hover and keyboard activation', async () => {
  const user = userEvent.setup();
  const data = snapshot();
  data.fills = data.fills.map(fill => ({ ...fill, reason: '집중도 한도 조정' }));
  render(<SnapshotDashboard snapshot={data} />);
  const trigger = screen.getAllByRole('button', { name: 'AMD 매수 체결 상세' })[0]!;
  await user.hover(trigger);
  expect(await screen.findByRole('tooltip')).toHaveTextContent('집중도 한도 조정');
  await user.unhover(trigger);
  trigger.focus();
  await user.keyboard('{Enter}');
  expect(await screen.findByRole('dialog')).toHaveTextContent('집중도 한도 조정');
});

it('does not create stock links from invalid source symbols', () => {
  const data = snapshot();
  data.holdings[0]!.symbol = '../login';
  data.fills[0]!.symbol = 'javascript:alert(1)';
  render(<SnapshotDashboard snapshot={data} />);
  expect(screen.queryAllByRole('link')).toHaveLength(0);
});

it('links holding and fill tickers to Toss without hardcoded instrument IDs', () => {
  render(<SnapshotDashboard snapshot={snapshot()} />);
  const links = screen.getAllByRole('link', { name: 'AMD 토스증권에서 보기 (새 탭)' });
  expect(links).toHaveLength(4);
  for (const link of links) {
    expect(link).toHaveAttribute('href', 'https://www.tossinvest.com/stocks/AMD');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
});

function fillsSnapshot(count: number) {
  const data = snapshot();
  data.fills = Array.from({ length: count }, (_, index) => ({
    ...data.fills[0]!,
    id: `fill-${index}`,
    symbol: `T${index}`,
    at: new Date(Date.UTC(2026, 8, 15, 0, index)).toISOString(),
  }));
  return data;
}

it.each([20, 21, 41])('makes all %i fills reachable in newest-first pages', async count => {
  const user = userEvent.setup();
  render(<SnapshotDashboard snapshot={fillsSnapshot(count)} />);
  expect(screen.getAllByRole('button', { name: /체결 상세/ })).toHaveLength(40);
  expect(screen.getByText(`조회 월 전체 ${count}건 · 최신순 · 1–20건 표시`)).toBeInTheDocument();
  if (count === 20) {
    expect(screen.queryByRole('navigation', { name: '체결 내역 페이지' })).not.toBeInTheDocument();
    return;
  }
  expect(screen.getByRole('button', { name: '이전' })).toBeDisabled();
  for (let page = 1; page < Math.ceil(count / 20); page++)
    await user.click(screen.getByRole('button', { name: '다음' }));
  expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  expect(screen.getAllByRole('button', { name: 'T0 매수 체결 상세' })).toHaveLength(2);
  await user.click(screen.getByRole('button', { name: '이전' }));
  expect(screen.getByRole('button', { name: '다음' })).toBeEnabled();
});

it('resets the page when changing month and clamps when refreshed fills shrink', async () => {
  const user = userEvent.setup();
  const data = fillsSnapshot(41);
  const { rerender } = render(<SnapshotDashboard snapshot={data} />);
  await user.click(screen.getByRole('button', { name: '다음' }));
  await user.click(screen.getByRole('button', { name: '다음' }));
  rerender(<SnapshotDashboard snapshot={{ ...data, fills: data.fills.slice(0, 21) }} />);
  expect(screen.getByText('2 / 2 페이지')).toBeInTheDocument();
  rerender(<SnapshotDashboard snapshot={{ ...data, month: '2026-08' }} />);
  expect(screen.getByText('1 / 3 페이지')).toBeInTheDocument();
});

it.each(['buy', 'sell'] as const)('shows %s fill amounts and handles missing reasons', async side => {
  const user = userEvent.setup();
  const data = snapshot();
  data.fills[0] = { ...data.fills[0]!, side, quantity: '1.5', price: '100.10', commission: '0.25' };
  render(<SnapshotDashboard snapshot={data} />);
  await user.click(screen.getAllByRole('button', { name: /체결 상세/ })[0]!);
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.getByText('$150.15')).toBeInTheDocument();
  expect(dialog.getByText(side === 'buy' ? '$150.40' : '$149.90')).toBeInTheDocument();
  expect(dialog.getByText('기록된 결정 근거가 없습니다.')).toBeInTheDocument();
});
