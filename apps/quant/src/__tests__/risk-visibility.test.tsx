import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import { OperationsPanel } from '../components/operations-panel';
import type { OperationsClient } from '../lib/operations-client';
import { SYNTHETIC_MONTH, SYNTHETIC_SESSION, SYNTHETIC_SUMMARY } from './fixtures/operations';

it('keeps the three connection questions visible instead of removing unavailable data', async () => {
  const row = { revision: 1, sourceAsOf: SYNTHETIC_SESSION.sourceAsOf, storedAt: SYNTHETIC_SESSION.exportedAt };
  const client: OperationsClient = {
    fetchMonth: async () => ({ ...row, payload: SYNTHETIC_MONTH as never }),
    fetchSessions: async () => [{ ...row, summary: SYNTHETIC_SUMMARY }],
    fetchSession: async () => ({ ...row, payload: SYNTHETIC_SESSION }),
  };
  render(<OperationsPanel client={client} episodeId="synthetic-paper" month="2026-09" />);
  await screen.findByText('TEST', { exact: true });
  expect(screen.getByRole('heading', { name: 'DB 적재 확인' })).toBeVisible();
  expect(screen.getByRole('heading', { name: '시장 일정·수집·발행 건강상태' })).toBeVisible();
  expect(screen.getByRole('heading', { name: '최근 판단·현재 위험상태' })).toBeVisible();
  expect(screen.getByText('검토 완료 후보 / 적용 대기')).toBeVisible();
  expect(screen.getByText(/이익 종목도 포함해 전체청산/)).toBeVisible();
});
