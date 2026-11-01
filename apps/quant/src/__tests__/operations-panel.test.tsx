import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';

import { OperationsPanel } from '../components/operations-panel';
import type { OperationsClient } from '../lib/operations-client';
import { SYNTHETIC_MONTH, SYNTHETIC_SESSION, SYNTHETIC_SUMMARY } from './fixtures/operations';

it('expires a running lease without waiting for a new network response', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-18T14:00:00Z'));
  const payload = structuredClone(SYNTHETIC_SESSION);
  Object.assign(payload.stages[0]!, {
    status: 'running',
    startedAt: '2026-09-18T13:59:00+00:00',
    evidenceAt: '2026-09-18T14:00:00+00:00',
    leaseUntil: '2026-09-18T14:00:02+00:00',
    evidenceIds: ['policy'],
  });
  const row = { revision: 1, sourceAsOf: payload.sourceAsOf, storedAt: payload.exportedAt };
  const client: OperationsClient = {
    fetchMonth: async () => ({ ...row, payload: SYNTHETIC_MONTH as never }),
    fetchSessions: async () => [{ ...row, summary: SYNTHETIC_SUMMARY }],
    fetchSession: async () => ({ ...row, payload }),
  };
  const { act } = await import('@testing-library/react');
  try {
    render(<OperationsPanel client={client} episodeId="synthetic-paper" month="2026-09" />);
    await act(async () => {});
    expect(screen.getByText('데이터 수집 · 진행')).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText('데이터 수집 · 실행 기록 · 현재 미확인')).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

it('shows future schedule timestamps without treating them as invalid observations', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-18T14:00:00Z'));
  const payload = structuredClone(SYNTHETIC_SESSION);
  payload.stages[0]!.nextExpectedAt = '2026-09-19T14:00:00+00:00';
  const row = { revision: 1, sourceAsOf: payload.sourceAsOf, storedAt: payload.exportedAt };
  const client: OperationsClient = {
    fetchMonth: async () => ({ ...row, payload: SYNTHETIC_MONTH as never }),
    fetchSessions: async () => [{ ...row, summary: SYNTHETIC_SUMMARY }],
    fetchSession: async () => ({ ...row, payload }),
  };
  const { act } = await import('@testing-library/react');
  try {
    render(<OperationsPanel client={client} episodeId="synthetic-paper" month="2026-09" />);
    await act(async () => {});
    expect(screen.getAllByText(/다음 예정/)[0]!).toHaveTextContent('9월 19일');
    expect(screen.getAllByText(/다음 예정/)[0]!).not.toHaveTextContent('미래 시각 · 확인 필요');
  } finally {
    vi.useRealTimers();
  }
});

it('renders strategy formulas, searches candidates, and never invents hold or ranking', async () => {
  const user = userEvent.setup();
  const row = { revision: 1, sourceAsOf: SYNTHETIC_SESSION.sourceAsOf, storedAt: SYNTHETIC_SESSION.exportedAt };
  const client: OperationsClient = {
    fetchMonth: vi.fn(async () => ({ ...row, payload: SYNTHETIC_MONTH as never })),
    fetchSessions: vi.fn(async () => [{ ...row, summary: SYNTHETIC_SUMMARY }]),
    fetchSession: vi.fn(async () => ({ ...row, payload: SYNTHETIC_SESSION })),
  };
  render(<OperationsPanel client={client} episodeId="synthetic-paper" month="2026-09" />);
  await screen.findByText('TEST');
  await user.type(screen.getByRole('searchbox', { name: '후보 티커 검색' }), 'ETF');
  expect(screen.queryByText('TEST')).not.toBeInTheDocument();
  expect(screen.getByText('ETF', { exact: true })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: '선정 · 미제공' })).toBeDisabled();
  await user.click(screen.getByText('공식·배분·위험 규칙'));
  expect(screen.getByText(/S =/)).toHaveTextContent('63');
  expect(screen.getByText(/S =/)).toHaveTextContent('126');
  expect(screen.queryByText('보유 유지')).not.toBeInTheDocument();
  await waitFor(() =>
    expect(client.fetchSession).toHaveBeenCalledWith(
      'synthetic-paper',
      '2026-09',
      '2026-09-18',
      expect.any(AbortSignal)
    )
  );
});
