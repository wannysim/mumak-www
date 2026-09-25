import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TEST_ONLY_PAPER_PAYLOAD } from '@/__tests__/fixtures/test-snapshot';
import { App } from '@/app';
import type { AuthEvent, AuthSession, DashboardClient } from '@/lib/dashboard-client';
import type { DashboardMode, DashboardSnapshot } from '@/lib/dashboard-schema';

function paperSnapshot(overrides: Partial<DashboardSnapshot> = {}): DashboardSnapshot {
  return structuredClone({ ...TEST_ONLY_PAPER_PAYLOAD, ...overrides }) as DashboardSnapshot;
}

class AppTestClient implements DashboardClient {
  session: AuthSession | null = null;
  requests: DashboardMode[] = [];
  magicLinkRequests: string[] = [];
  snapshots: Record<DashboardMode, DashboardSnapshot[]> = { paper: [paperSnapshot()], live: [] };
  fetchError = false;
  private listener?: (event: AuthEvent, session: AuthSession | null) => void;

  async getSession() {
    return this.session;
  }

  onAuthStateChange(listener: (event: AuthEvent, session: AuthSession | null) => void) {
    this.listener = listener;
    return () => {
      this.listener = undefined;
    };
  }

  async fetchSnapshots(mode: DashboardMode) {
    this.requests.push(mode);
    if (this.fetchError) throw new Error('test-only fetch error');
    return this.snapshots[mode];
  }

  async requestMagicLink(email: string) {
    this.magicLinkRequests.push(email);
  }

  async signOut() {
    this.session = null;
    this.listener?.('SIGNED_OUT', null);
  }
}

describe('Quant dashboard app', () => {
  beforeEach(() => {
    // jsdom has no layout; provide a measured container for ResponsiveContainer.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 720,
      bottom: 360,
      width: 720,
      height: 360,
      toJSON: () => ({}),
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('warns when logout fails while clearing private display', async () => {
    const client = new AppTestClient();
    client.session = { userId: 'owner-1' };
    vi.spyOn(client, 'signOut').mockRejectedValue(new Error('TEST_ONLY signout failure'));
    render(<App client={client} />);
    await screen.findByRole('heading', { name: '테스트 운용 1기' });
    await userEvent.click(screen.getByRole('tab', { name: '실운용' }));
    await screen.findByText('실운용 내역이 아직 없습니다.');
    await userEvent.click(screen.getByRole('button', { name: '로그아웃' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('공유 기기');
    expect(screen.getByRole('heading', { name: '실운용 내역 로그인' })).toBeInTheDocument();
  });

  it('fails closed to login rather than hanging when session recovery fails', async () => {
    const client = new AppTestClient();
    vi.spyOn(client, 'getSession').mockRejectedValue(new Error('TEST_ONLY session error'));
    render(<App client={client} />);
    await screen.findByRole('heading', { name: '테스트 운용 1기' });
    await userEvent.click(screen.getByRole('tab', { name: '실운용' }));
    expect(await screen.findByRole('heading', { name: '실운용 내역 로그인' })).toBeInTheDocument();
    expect(client.requests).not.toContain('live');
  });

  it('renders a public paper snapshot with source semantics and accessible finance details', async () => {
    render(<App client={new AppTestClient()} />);

    expect(screen.getByRole('heading', { level: 1, name: '퀀트 대시보드' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: '테스트 운용 1기' })).toBeInTheDocument();
    expect(screen.getByText(/운용 시작월 · 부분 월/)).toBeInTheDocument();
    expect(await screen.findByRole('status', { name: '선택 시점 성과' })).toHaveTextContent('$101,250.50');
    expect(screen.getByRole('img', { name: /NAV 및 수익률 추이/ })).toBeInTheDocument();
    expect(screen.getAllByText('TEST').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('매수').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/실시간 시세가 아닌 저장된 운용 현황/)).toBeInTheDocument();
    expect(screen.getByText(/^데이터 기준 시각 /)).toBeInTheDocument();
  });

  it('renders the selected month from the same episode', async () => {
    const client = new AppTestClient();
    client.snapshots.paper = [
      paperSnapshot({ label: '9월 기록' }),
      paperSnapshot({
        month: '2026-08',
        label: '8월 기록',
        asOf: '2026-08-31T05:30:00.000Z',
        baselineKind: 'month-start',
        summary: { ...TEST_ONLY_PAPER_PAYLOAD.summary, currentNav: '99000.00', profit: '-1000.00' },
      }),
    ];
    render(<App client={client} />);
    await screen.findByRole('heading', { level: 2, name: '9월 기록' });

    await userEvent.click(screen.getByRole('combobox', { name: '조회 월' }));
    await userEvent.click(screen.getByRole('option', { name: '2026-08' }));

    expect(screen.getByRole('heading', { level: 2, name: '8월 기록' })).toBeInTheDocument();
    expect(screen.getByText(/월초 기준 · 전체 월/)).toBeInTheDocument();
    expect(screen.getByText('$99,000.00')).toBeInTheDocument();
  });

  it('shows a generic magic-link result and never requests live data while anonymous', async () => {
    const client = new AppTestClient();
    render(<App client={client} />);
    await screen.findByRole('heading', { level: 2, name: '테스트 운용 1기' });

    await userEvent.click(screen.getByRole('tab', { name: '실운용' }));
    await userEvent.type(screen.getByRole('textbox', { name: '이메일' }), 'owner@example.test');
    await userEvent.click(screen.getByRole('button', { name: '로그인 링크 받기' }));

    expect(client.requests).not.toContain('live');
    expect(client.magicLinkRequests).toEqual(['owner@example.test']);
    // 앱에 전역 알림 영역(role="status" name="알림")이 생겨서 로그인 안내를 문구로 집는다.
    expect(screen.getByText('로그인 요청을 처리했습니다. 등록된 계정이라면 이메일을 확인해 주세요.')).toHaveAttribute(
      'role',
      'status'
    );
  });

  it('shows an explicit empty state for an authenticated live portfolio', async () => {
    const client = new AppTestClient();
    client.session = { userId: 'owner-1' };
    render(<App client={client} />);
    await screen.findByRole('heading', { level: 2, name: '테스트 운용 1기' });

    await userEvent.click(screen.getByRole('tab', { name: '실운용' }));

    expect(await screen.findByText('실운용 내역이 아직 없습니다.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '로그아웃' }));
    expect(await screen.findByRole('heading', { name: '실운용 내역 로그인' })).toBeInTheDocument();
  });

  it('fails closed with an explicit state when Supabase is not configured', () => {
    render(<App client={null} />);

    expect(screen.getByText('대시보드가 아직 연결되지 않았습니다.')).toBeInTheDocument();
    expect(screen.queryByText('$101,250.50')).not.toBeInTheDocument();
  });

  it('renders explicit empty finance sections without inventing data', async () => {
    const client = new AppTestClient();
    client.snapshots.paper = [paperSnapshot({ history: [], holdings: [], fills: [], notes: [] })];
    render(<App client={client} />);

    await screen.findByRole('heading', { level: 2, name: '테스트 운용 1기' });

    expect(screen.getByText('표시할 시계열이 없습니다.')).toBeInTheDocument();
    expect(screen.getByText('보유 종목이 없습니다.')).toBeInTheDocument();
    expect(screen.getByText('최근 체결이 없습니다.')).toBeInTheDocument();
  });

  it('fails closed when the snapshot query fails', async () => {
    const client = new AppTestClient();
    client.fetchError = true;
    render(<App client={client} />);

    expect(await screen.findByRole('heading', { name: '운용 내역을 불러오지 못했습니다.' })).toBeInTheDocument();
    expect(screen.queryByText('$101,250.50')).not.toBeInTheDocument();
  });
});
