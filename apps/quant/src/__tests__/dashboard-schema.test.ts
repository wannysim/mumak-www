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
