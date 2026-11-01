import { describe, expect, it, vi } from 'vitest';

import { SupabaseOperationsClient } from '../lib/operations-client';
import { SYNTHETIC_MONTH, SYNTHETIC_SESSION, SYNTHETIC_SUMMARY } from './fixtures/operations';

describe('operations read-only client', () => {
  it('binds exact episode/month/session and validates row metadata', async () => {
    const filters: string[][] = [];
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((key: string, value: string) => {
        filters.push([key, value]);
        return query;
      }),
      order: vi.fn(() => query),
      abortSignal: vi.fn(async () => ({
        data: [
          {
            episode_id: SYNTHETIC_SESSION.episodeId,
            month: SYNTHETIC_SESSION.month,
            session: SYNTHETIC_SESSION.session,
            revision: 1,
            source_as_of: SYNTHETIC_SESSION.sourceAsOf,
            stored_at: SYNTHETIC_SESSION.exportedAt,
            summary: SYNTHETIC_SUMMARY,
            payload: SYNTHETIC_SESSION,
          },
        ],
        error: null,
      })),
    };
    const client = new SupabaseOperationsClient({ from: () => query });
    const row = await client.fetchSession('synthetic-paper', '2026-09', '2026-09-18', new AbortController().signal);
    expect(row?.payload).toEqual(SYNTHETIC_SESSION);
    expect(filters).toEqual([
      ['episode_id', 'synthetic-paper'],
      ['month', '2026-09'],
      ['session', '2026-09-18'],
    ]);
    query.abortSignal.mockResolvedValueOnce({
      data: [{ episode_id: 'other', month: '2026-09', payload: SYNTHETIC_MONTH }],
      error: null,
    } as never);
    await expect(client.fetchMonth('synthetic-paper', '2026-09', new AbortController().signal)).rejects.toThrow(
      'schema'
    );
  });
  it.each(['stage', 'extra-key'])('rejects inconsistent detail %s even when counts match', async mutation => {
    const summary = structuredClone(SYNTHETIC_SUMMARY);
    if (mutation === 'stage') summary.stages[0]!.status = 'succeeded';
    const row = {
      episode_id: SYNTHETIC_SESSION.episodeId,
      month: SYNTHETIC_SESSION.month,
      session: SYNTHETIC_SESSION.session,
      revision: 1,
      source_as_of: SYNTHETIC_SESSION.sourceAsOf,
      stored_at: SYNTHETIC_SESSION.exportedAt,
      payload: SYNTHETIC_SESSION,
      summary,
      ...(mutation === 'extra-key' ? { private: 'not allowed' } : {}),
    };
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      abortSignal: async () => ({ data: [row], error: null }),
    };
    const client = new SupabaseOperationsClient({ from: () => query });
    await expect(
      client.fetchSession('synthetic-paper', '2026-09', '2026-09-18', new AbortController().signal)
    ).rejects.toThrow('schema');
  });
  it.each([
    ['42P01', 'not-provisioned'],
    ['42501', 'access'],
    ['500', 'transport'],
  ])('sanitizes %s without treating failure as empty', async (code, kind) => {
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      abortSignal: async () => ({ data: null, error: { code, message: 'PRIVATE_TOKEN' } }),
    };
    const client = new SupabaseOperationsClient({ from: () => query });
    await expect(client.fetchMonth('synthetic-paper', '2026-09', new AbortController().signal)).rejects.toThrow(kind);
  });
});
