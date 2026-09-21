import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TEST_ONLY_PAPER_PAYLOAD } from '@/__tests__/fixtures/test-snapshot';
import { useDashboardController } from '@/hooks/use-dashboard-controller';
import type { AuthEvent, AuthSession, DashboardClient } from '@/lib/dashboard-client';
import type { DashboardMode, DashboardSnapshot } from '@/lib/dashboard-schema';

function snapshot(overrides: Partial<DashboardSnapshot> = {}): DashboardSnapshot {
  return structuredClone({ ...TEST_ONLY_PAPER_PAYLOAD, ...overrides }) as DashboardSnapshot;
}

function liveSnapshot(overrides: Partial<DashboardSnapshot> = {}): DashboardSnapshot {
  return snapshot({
    mode: 'live',
    source: 'live-ledger',
    episodeId: 'live-2026',
    label: '라이브 테스트',
    ...overrides,
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

class FakeDashboardClient implements DashboardClient {
  session: AuthSession | null = null;
  requests: DashboardMode[] = [];
  fetchImplementation: DashboardClient['fetchSnapshots'] = async mode =>
    mode === 'paper' ? [snapshot()] : [liveSnapshot()];
  private authListener?: (event: AuthEvent, session: AuthSession | null) => void;

  async getSession() {
    return this.session;
  }

  onAuthStateChange(listener: (event: AuthEvent, session: AuthSession | null) => void) {
    this.authListener = listener;
    return () => {
      this.authListener = undefined;
    };
  }

  fetchSnapshots(mode: DashboardMode, signal: AbortSignal) {
    this.requests.push(mode);
    return this.fetchImplementation(mode, signal);
  }

  async requestMagicLink() {}

  async signOut() {
    this.session = null;
  }

  emit(event: AuthEvent, session: AuthSession | null) {
    this.session = session;
    this.authListener?.(event, session);
  }
}

function ControllerHarness({ client }: { client: DashboardClient }) {
  const controller = useDashboardController(client);
  return (
    <div>
      <button type="button" onClick={() => controller.selectMode('paper')}>
        모의 운용
      </button>
      <button type="button" onClick={() => controller.selectMode('live')}>
        실운용
      </button>
      <output aria-label="상태">{controller.data.status}</output>
      <output aria-label="라벨">{controller.selectedSnapshot?.label ?? '없음'}</output>
      <label>
        월
        <select value={controller.selectedMonth ?? ''} onChange={event => controller.selectMonth(event.target.value)}>
          {controller.months.map(month => (
            <option key={month} value={month}>
              {month}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

describe('useDashboardController', () => {
  it('does not request live snapshots for an anonymous visitor', async () => {
    const client = new FakeDashboardClient();
    render(<ControllerHarness client={client} />);

    await screen.findByText('테스트 운용 1기');
    await userEvent.click(screen.getByRole('button', { name: '실운용' }));

    expect(client.requests).not.toContain('live');
    expect(screen.getByLabelText('상태')).toHaveTextContent('idle');
  });

  it('drops an out-of-order live response after switching back to paper', async () => {
    const client = new FakeDashboardClient();
    client.session = { userId: 'owner-1', email: 'owner@example.test' };
    const lateLive = deferred<DashboardSnapshot[]>();
    client.fetchImplementation = (mode: DashboardMode) =>
      mode === 'paper' ? Promise.resolve([snapshot()]) : lateLive.promise;
    render(<ControllerHarness client={client} />);
    await screen.findByText('테스트 운용 1기');

    await userEvent.click(screen.getByRole('button', { name: '실운용' }));
    await userEvent.click(screen.getByRole('button', { name: '모의 운용' }));
    await act(() => {
      lateLive.resolve([liveSnapshot({ label: '늦게 도착한 민감 데이터' })]);
      return lateLive.promise;
    });

    expect(screen.getByLabelText('라벨')).toHaveTextContent('테스트 운용 1기');
    expect(screen.queryByText('늦게 도착한 민감 데이터')).not.toBeInTheDocument();
  });

  it('drops the pre-refresh live response and keeps the refreshed result', async () => {
    const client = new FakeDashboardClient();
    const session = { userId: 'owner-1', email: 'owner@example.test' };
    client.session = session;
    const beforeRefresh = deferred<DashboardSnapshot[]>();
    const afterRefresh = deferred<DashboardSnapshot[]>();
    let liveRequest = 0;
    client.fetchImplementation = (mode: DashboardMode) => {
      if (mode === 'paper') return Promise.resolve([snapshot()]);
      liveRequest += 1;
      return liveRequest === 1 ? beforeRefresh.promise : afterRefresh.promise;
    };
    render(<ControllerHarness client={client} />);
    await screen.findByText('테스트 운용 1기');
    await userEvent.click(screen.getByRole('button', { name: '실운용' }));

    act(() => client.emit('TOKEN_REFRESHED', session));
    await act(() => {
      afterRefresh.resolve([liveSnapshot({ label: '갱신된 실운용' })]);
      return afterRefresh.promise;
    });
    await act(() => {
      beforeRefresh.resolve([liveSnapshot({ label: '폐기할 이전 응답' })]);
      return beforeRefresh.promise;
    });

    expect(screen.getByLabelText('라벨')).toHaveTextContent('갱신된 실운용');
    expect(screen.queryByText('폐기할 이전 응답')).not.toBeInTheDocument();
  });

  it('exposes an explicit empty state for an authenticated live portfolio', async () => {
    const client = new FakeDashboardClient();
    client.session = { userId: 'owner-1' };
    client.fetchImplementation = async mode => (mode === 'paper' ? [snapshot()] : []);
    render(<ControllerHarness client={client} />);
    await screen.findByText('테스트 운용 1기');

    await userEvent.click(screen.getByRole('button', { name: '실운용' }));

    expect(await screen.findByLabelText('상태')).toHaveTextContent('empty');
    expect(client.requests.filter(mode => mode === 'live')).toEqual(['live']);
  });

  it('switches the selected month without mixing episodes', async () => {
    const client = new FakeDashboardClient();
    client.fetchImplementation = async () => [
      snapshot({ month: '2026-09', label: '9월 스냅샷' }),
      snapshot({ month: '2026-08', label: '8월 스냅샷', asOf: '2026-08-31T05:30:00.000Z' }),
      snapshot({ episodeId: 'paper-older', month: '2026-07', label: '이전 에피소드' }),
    ];
    render(<ControllerHarness client={client} />);
    await screen.findByText('9월 스냅샷');

    await userEvent.selectOptions(screen.getByRole('combobox', { name: '월' }), '2026-08');

    expect(screen.getByLabelText('라벨')).toHaveTextContent('8월 스냅샷');
    expect(screen.queryByRole('option', { name: '2026-07' })).not.toBeInTheDocument();
  });
});
