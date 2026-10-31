import { render, screen, within } from '@testing-library/react';

import { TEST_ONLY_PAPER_PAYLOAD } from '@/__tests__/fixtures/test-snapshot';
import { DataContext } from '@/components/data-context';
import type { ModeData } from '@/hooks/use-dashboard-controller';
import { parseSnapshotPayload, type DashboardSnapshot } from '@/lib/dashboard-schema';

const base = parseSnapshotPayload(TEST_ONLY_PAPER_PAYLOAD, 'paper');

const query: ModeData = { status: 'ready', snapshots: [], lastSuccessAt: '2026-10-23T05:30:00Z' };
function show(overrides: Partial<DashboardSnapshot> = {}, state: ModeData = query) {
  return render(<DataContext snapshot={{ ...base, ...overrides }} query={state} />);
}
function field(label: string) {
  const term = screen.getByText(label, { selector: 'dt' });
  return within(term.parentElement!).getByRole('definition');
}

describe('DataContext (test-only snapshots)', () => {
  it('reuses the New York month formatter when query timestamps change', () => {
    const formatter = vi.spyOn(Intl, 'DateTimeFormat');
    try {
      const view = show({ month: '2026-10' }, { ...query, lastSuccessAt: '2026-11-01T03:59:00Z' });
      expect(field('회차 범위(웹 조회 시점)')).toHaveTextContent('현재 월 기록');
      const constructions = formatter.mock.calls.length;
      view.rerender(
        <DataContext
          snapshot={{ ...base, month: '2026-10' }}
          query={{ ...query, lastSuccessAt: '2026-11-01T04:01:00Z' }}
        />
      );
      expect(field('회차 범위(웹 조회 시점)')).toHaveTextContent('과거 기록');
      expect(formatter.mock.calls).toHaveLength(constructions);
    } finally {
      formatter.mockRestore();
    }
  });

  it('separates historical scope, clocks and unconnected health without inventing decisions', () => {
    show({ holdings: [], fills: [] });
    expect(field('회차 범위(웹 조회 시점)')).toHaveTextContent('과거 기록');
    expect(screen.getByText(/가상 자금 · 실계좌 아님/)).toBeInTheDocument();
    expect(screen.queryByText('DB 적재 확인')).not.toBeInTheDocument();
    expect(screen.queryByText('시장 일정·수집·발행 건강상태')).not.toBeInTheDocument();
    expect(field('최근 체결 시각')).toHaveTextContent('저장된 체결 없음');
    expect(screen.queryByText('최근 판단·현재 위험상태')).not.toBeInTheDocument();
    expect(screen.queryByText(/HOLD/)).not.toBeInTheDocument();
  });

  it('chooses the latest recorded fill rather than assuming array order', () => {
    const fill = base.fills[0]!;
    show({
      fills: [
        { ...fill, at: '2026-09-20T10:00:00Z' },
        { ...fill, at: '2026-09-19T10:00:00Z' },
      ],
    });
    expect(field('최근 체결 시각')).toHaveTextContent('20');
  });

  it('does not make future clocks or a future month look fresh', () => {
    show({ month: '2026-11', exportedAt: '2099-01-01T00:00:00Z' });
    expect(field('회차 범위(웹 조회 시점)')).toHaveTextContent('미래 회차');
    expect(field('내보냄')).toHaveTextContent('시각 확인 필요');
  });

  it('keeps ledger time fixed when only export and web fetch advance', () => {
    const original = structuredClone(base);
    const view = show();
    const ledger = field('원장 기준').textContent;
    view.rerender(
      <DataContext
        snapshot={{ ...original, exportedAt: '2026-10-23T05:29:00Z' }}
        query={{ ...query, lastSuccessAt: '2026-10-23T05:31:00Z' }}
      />
    );
    expect(field('원장 기준').textContent).toBe(ledger);
    expect(field('웹 조회')).toHaveTextContent('조회 성공');
    expect(original.summary.currentNav).toBe(TEST_ONLY_PAPER_PAYLOAD.summary.currentNav);
  });

  it.each(['loading', 'paused'] as const)(
    'labels last-good data during %s without claiming current success',
    status => {
      show({}, { ...query, status });
      expect(field('웹 조회')).toHaveTextContent('이전 성공 자료');
    }
  );

  it('does not give a private record a public PAPER label', () => {
    show({ mode: 'live', source: 'live-ledger', month: '2026-10' });
    expect(screen.getByText('소유자 전용 실운용 기록')).toBeInTheDocument();
    expect(field('회차 범위(웹 조회 시점)')).toHaveTextContent('현재 월 기록');
    expect(field('웹 조회')).toHaveTextContent('조회 성공');
    expect(screen.queryByText(/공개 모의/)).not.toBeInTheDocument();
  });
});
