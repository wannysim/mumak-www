import { TEST_ONLY_PAPER_PAYLOAD, TEST_ONLY_PAPER_ROW } from '@/__tests__/fixtures/test-snapshot';
import { mapSnapshotRow, parseSnapshotPayload, SnapshotValidationError } from '@/lib/dashboard-schema';

describe('dashboard snapshot ingress', () => {
  it('accepts Python and PostgreSQL microsecond timestamps from the real producer', () => {
    const at = '2026-09-18T20:15:37.354712+00:00';
    const payload = { ...TEST_ONLY_PAPER_PAYLOAD, asOf: at, exportedAt: at };
    expect(mapSnapshotRow({ ...TEST_ONLY_PAPER_ROW, as_of: at, payload }, 'paper').asOf).toBe(at);
  });

  it('accepts the version 1 contract fixture', () => {
    expect(parseSnapshotPayload(TEST_ONLY_PAPER_PAYLOAD, 'paper')).toMatchObject({
      mode: 'paper',
      episodeId: 'paper-2026',
      month: '2026-09',
    });
  });

  it('accepts the exporter cash-only pending baseline without invented market rows', () => {
    const payload = {
      ...structuredClone(TEST_ONLY_PAPER_PAYLOAD),
      episodeId: 'paper-intraday-2026-09',
      status: 'pending',
      label: '미국 주식 장중 15분 ORB 모의운용 · 시작 대기',
      startedAt: '2026-09-26T03:43:19.000Z',
      asOf: '2026-09-26T03:43:19.000Z',
      exportedAt: '2026-09-26T04:00:00.000Z',
      summary: {
        ...TEST_ONLY_PAPER_PAYLOAD.summary,
        startingNav: '100000',
        currentNav: '100000',
        cash: '100000',
        profit: '0',
        returnPct: '0',
      },
      holdings: [],
      history: [{ at: '2026-09-26T03:43:19.000Z', nav: '100000', profit: '0', returnPct: '0' }],
      fills: [],
      notes: ['완결봉과 후속 관측이 아직 없는 시작 대기 현금 기준선입니다.'],
    };

    const parsed = parseSnapshotPayload(payload, 'paper');

    expect(parsed.summary).toMatchObject({ currentNav: '100000', cash: '100000', profit: '0' });
    expect(parsed.holdings).toEqual([]);
    expect(parsed.fills).toEqual([]);
    expect(parsed.history).toHaveLength(1);
  });

  it('normalizes a legacy fill without reason to null', () => {
    expect(parseSnapshotPayload(TEST_ONLY_PAPER_PAYLOAD, 'paper').fills[0]?.reason).toBeNull();
  });

  it('accepts a bounded optional fill reason', () => {
    const payload = structuredClone(TEST_ONLY_PAPER_PAYLOAD) as unknown as {
      fills: Array<Record<string, unknown>>;
    };
    payload.fills[0] = { ...payload.fills[0], reason: '정기 리밸런싱' };

    expect(parseSnapshotPayload(payload, 'paper').fills[0]?.reason).toBe('정기 리밸런싱');
  });

  it.each(['', ' 정기 리밸런싱', 'x'.repeat(81), 42])('rejects malformed fill reason %s', reason => {
    const payload = structuredClone(TEST_ONLY_PAPER_PAYLOAD) as Record<string, unknown>;
    payload.fills = [{ ...TEST_ONLY_PAPER_PAYLOAD.fills[0], reason }];

    expect(() => parseSnapshotPayload(payload, 'paper')).toThrow(SnapshotValidationError);
  });

  it('retains strict fill unknown-field rejection with optional reason', () => {
    const payload = structuredClone(TEST_ONLY_PAPER_PAYLOAD) as Record<string, unknown>;
    payload.fills = [{ ...TEST_ONLY_PAPER_PAYLOAD.fills[0], reason: null, privateDiagnostic: 'secret' }];

    expect(() => parseSnapshotPayload(payload, 'paper')).toThrow(/unexpected field/);
  });

  it.each(['NaN', 'Infinity', '1e309', '1,000', '', ' 1.0'])('rejects malformed decimal string %s', decimal => {
    const payload = structuredClone(TEST_ONLY_PAPER_PAYLOAD) as Record<string, unknown>;
    payload.summary = { ...TEST_ONLY_PAPER_PAYLOAD.summary, currentNav: decimal };

    expect(() => parseSnapshotPayload(payload, 'paper')).toThrow(SnapshotValidationError);
  });

  it('rejects a payload from the other portfolio mode', () => {
    const payload = { ...TEST_ONLY_PAPER_PAYLOAD, mode: 'live', source: 'live-ledger' };

    expect(() => parseSnapshotPayload(payload, 'paper')).toThrow(/mode/i);
  });

  it.each([
    ['episode_id', 'another-episode'],
    ['month', '2026-08'],
    ['as_of', '2026-09-21T05:32:00.000Z'],
  ] as const)('rejects row and payload mismatch for %s', (field, value) => {
    expect(() => mapSnapshotRow({ ...TEST_ONLY_PAPER_ROW, [field]: value }, 'paper')).toThrow(SnapshotValidationError);
  });

  it('rejects future schema versions closed', () => {
    expect(() => parseSnapshotPayload({ ...TEST_ONLY_PAPER_PAYLOAD, schemaVersion: 2 }, 'paper')).toThrow(
      SnapshotValidationError
    );
  });
});
