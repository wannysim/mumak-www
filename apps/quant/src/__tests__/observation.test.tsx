import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';

import { RiskObservations, PriceRail, freshness } from '../components/risk-observations';
import { parseObservation } from '../lib/observation-schema';
import {
  OperationsError,
  SupabaseOperationsClient,
  type OperationsClient,
  type SupabaseOperationsLike,
} from '../lib/operations-client';
import fixture from './fixtures/observation.json';

const payload = () => parseObservation(structuredClone(fixture.payload));
const row = () => ({
  payload: payload(),
  revision: 1,
  sourceAsOf: fixture.payload.sourceAsOf,
  storedAt: fixture.payload.exportedAt,
});
function client(): OperationsClient {
  return {
    fetchMonth: async () => null,
    fetchSession: async () => null,
    fetchSessions: async () => [],
    fetchObservation: vi.fn(async () => row()),
  };
}
afterEach(() => vi.useRealTimers());
it('accepts the real Python-produced synthetic projection and rejects every shared SQL/Python invalid control', () => {
  expect(payload().origin).toBe('synthetic');
  for (const [name, changes] of fixture.invalid) {
    const p: unknown = structuredClone(fixture.payload);
    for (const [path, value] of changes as [Array<string | number>, unknown][]) {
      let obj = p as Record<string, unknown>;
      for (const key of path.slice(0, -1)) obj = obj[key] as Record<string, unknown>;
      obj[path.at(-1)!] = value;
    }
    expect({
      name,
      rejected: (() => {
        try {
          parseObservation(p);
          return false;
        } catch {
          return true;
        }
      })(),
    }).toEqual({ name, rejected: true });
  }
});
it('shows source-bound account and symbol observations, typed reasons and display-only distance, not live installation', async () => {
  const c = client();
  render(
    <RiskObservations client={c} episodeId="synthetic-paper" month="2026-09" financialAsOf="2026-09-18T13:59:00Z" />
  );
  await screen.findByText('TESTA');
  expect(screen.getByText('선택 재무 snapshot과 readback receipt 일치')).toBeVisible();
  expect(screen.getByText('감축 판단')).toBeVisible();
  expect(screen.getByText(/가격 기준 미제공/)).toBeVisible();
  expect(screen.getByRole('img', { name: /TESTA 가격 기준/ })).toBeVisible();
  expect(screen.getAllByText(/유효기간 경과/).length).toBeGreaterThan(1);
  expect(screen.getByText(/감시 1 \/ 감축 1/)).toBeVisible();
  expect(screen.getByText('검토 완료 후보 / 적용 대기')).toBeVisible();
  expect(screen.queryByText('현재 정상')).not.toBeInTheDocument();
  const user = userEvent.setup();
  await user.click(screen.getByText('후보 공식과 승인 범위'));
  expect(screen.getByText(/거리 d =/)).toBeVisible();
  await user.keyboard('{Escape}');
  expect(screen.getByText(/거리 d =/)).not.toBeVisible();
  await user.click(screen.getByText('관측 출처·유효범위·서로 다른 시계'));
  expect(screen.getByText(/적용 범위/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: '연결·위험 다시 조회' }));
  await waitFor(() => expect(c.fetchObservation).toHaveBeenCalledTimes(2));
});
it('expires account and symbol validity on the visible clock without a new response', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-18T14:14:59Z'));
  render(<RiskObservations client={client()} episodeId="synthetic-paper" month="2026-09" />);
  await act(async () => {});
  expect(screen.getAllByText(/합성 검증 기록 · 운영 아님/).length).toBeGreaterThan(0);
  await act(async () => vi.advanceTimersByTime(1000));
  expect(screen.getAllByText(/유효기간 경과 · 현재 UNKNOWN/).length).toBeGreaterThan(0);
});
it('keeps query failures isolated and supports explicit recovery without exposing raw errors', async () => {
  const c = client();
  c.fetchObservation = vi.fn().mockRejectedValueOnce(new OperationsError('not-provisioned')).mockResolvedValue(row());
  render(<RiskObservations client={c} episodeId="synthetic-paper" month="2026-09" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('관측 DB/RPC 미설치');
  expect(screen.getByText('DB 적재 확인')).toBeVisible();
  await userEvent.setup().click(screen.getByRole('button', { name: '연결·위험 다시 조회' }));
  await screen.findByText('TESTA');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('distinguishes absent, empty and partial evidence, stopped account and full-exit from actual fills', async () => {
  const r = row();
  r.payload.symbols = { availability: 'recorded', value: [], evidenceIds: ['risk'] };
  r.payload.decision = { availability: 'unsupported', value: null, evidenceIds: [] };
  r.payload.ingest = { availability: 'unsupported', value: null, evidenceIds: [] };
  r.payload.schedule = { availability: 'unsupported', value: null, evidenceIds: [] };
  r.payload.collection = { availability: 'unsupported', value: null, evidenceIds: [] };
  r.payload.account.value!.state = 'stopped';
  r.payload.account.value!.reason = 'daily-loss-stop';
  const c = client();
  c.fetchObservation = async () => r;
  render(<RiskObservations client={c} episodeId="synthetic-paper" month="2026-09" />);
  await screen.findByText(/빈 평가 목록을 기록/);
  expect(screen.getByText('전체청산 경계 발동 기록')).toBeVisible();
  expect(screen.getByText('판단 receipt 미지원 · UNKNOWN')).toBeVisible();
  expect(screen.getByText(/재무 적재 receipt 미지원/)).toBeVisible();
});
it('never carries another month while a new observation is pending and discards late generations', async () => {
  const c = client();
  let resolve: ((value: ReturnType<typeof row>) => void) | undefined;
  c.fetchObservation = vi
    .fn()
    .mockImplementationOnce(() => new Promise(r => (resolve = r)))
    .mockResolvedValue(null);
  const view = render(<RiskObservations client={c} episodeId="synthetic-paper" month="2026-09" />);
  view.rerender(<RiskObservations client={c} episodeId="synthetic-paper" month="2026-10" />);
  await screen.findByText('해당 월 source-native receipt 미등록');
  await act(async () => resolve!(row()));
  expect(screen.queryByText('TESTA')).not.toBeInTheDocument();
});
it('uses explicit origin and validity, including future observations, without inferential health', () => {
  const p = payload();
  const a = p.account.value!;
  expect(freshness(a, p, Date.parse('2026-09-18T13:59:00Z'))).toContain('미래');
  expect(freshness(a, { ...p, origin: 'paper-runtime' }, Date.parse('2026-09-18T14:01:00Z'))).toBe(
    '원천 유효범위 내 관측'
  );
  render(<PriceRail risk={{ ...p.symbols.value![0]!, state: 'full-exit', reason: 'symbol-stop', mark: '100' }} />);
  expect(screen.getByText(/손절선 대비 평가가격 -/)).toBeVisible();
});
function queryFor(result: unknown, error: { code?: string; status?: number } | null = null, status = 200) {
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    abortSignal: vi.fn(async () => ({ data: result, error, status })),
  };
  q.select.mockReturnValue(q);
  q.eq.mockReturnValue(q);
  q.order.mockReturnValue(q);
  const supabase = { from: vi.fn(() => q) };
  return { q, supabase, api: new SupabaseOperationsClient(supabase as unknown as SupabaseOperationsLike) };
}
function stored() {
  const r = row();
  return {
    episode_id: r.payload.episodeId,
    month: r.payload.month,
    session: r.payload.session,
    revision: r.revision,
    source_as_of: r.sourceAsOf,
    stored_at: r.storedAt,
    payload: r.payload,
  };
}
it('binds observation row identity, scope and exact metadata; empty and partial failures remain distinct', async () => {
  const r = stored();
  const signal = new AbortController().signal;
  const { api, q, supabase } = queryFor([r]);
  expect((await api.fetchObservation('synthetic-paper', '2026-09', signal))?.payload).toEqual(payload());
  expect(supabase.from).toHaveBeenCalledWith('paper_observations');
  expect(q.abortSignal).toHaveBeenCalledWith(signal);
  expect(await queryFor([]).api.fetchObservation('synthetic-paper', '2026-09', signal)).toBeNull();
  for (const bad of [
    { ...r, session: '2026-09-19' },
    { ...r, month: '2026-10' },
    { ...r, source_as_of: '2026-09-18T13:59:00+00:00' },
    { ...r, private: 'PRIVATE' },
    { ...r, revision: 0 },
  ])
    await expect(queryFor([bad]).api.fetchObservation('synthetic-paper', '2026-09', signal)).rejects.toMatchObject({
      kind: 'schema',
    });
  await expect(queryFor([r, r]).api.fetchObservation('synthetic-paper', '2026-09', signal)).rejects.toMatchObject({
    kind: 'schema',
  });
  await expect(
    queryFor(Array(32).fill(r)).api.fetchObservation('synthetic-paper', '2026-09', signal)
  ).rejects.toMatchObject({ kind: 'schema' });
  await expect(
    queryFor(null, { code: '42P01' }).api.fetchObservation('synthetic-paper', '2026-09', signal)
  ).rejects.toMatchObject({ kind: 'not-provisioned' });
  expect(within(document.body).queryByText('PRIVATE')).not.toBeInTheDocument();
});
