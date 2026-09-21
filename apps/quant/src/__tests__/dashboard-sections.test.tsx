import { render, screen } from '@testing-library/react';
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
  const trigger = screen.getAllByRole('button', { name: 'AMD 매수 결정 근거' })[0]!;
  await user.click(trigger);
  expect(await screen.findByRole('dialog', { name: 'AMD 매수 결정 근거' })).toHaveTextContent('정기 리밸런싱');
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it('keeps absent historical reasons blank instead of inventing an explanation', () => {
  render(<SnapshotDashboard snapshot={snapshot()} />);
  expect(screen.queryByRole('button', { name: /결정 근거/ })).not.toBeInTheDocument();
});

it('shows the recorded reason on pointer hover and keyboard activation', async () => {
  const user = userEvent.setup();
  const data = snapshot();
  data.fills = data.fills.map(fill => ({ ...fill, reason: '집중도 한도 조정' }));
  render(<SnapshotDashboard snapshot={data} />);
  const trigger = screen.getAllByRole('button', { name: 'AMD 매수 결정 근거' })[0]!;
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
