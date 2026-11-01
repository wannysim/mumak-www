import { describe, expect, it } from 'vitest';

import { parseOperations } from '../lib/operations-schema';
import { SYNTHETIC_SESSION } from './fixtures/operations';
import invalid from './fixtures/operations-invalid.json';
import month from './fixtures/operations-month.json';

describe('public operations independent contract', () => {
  it.each(invalid)('rejects shared corpus: $name', ({ base, changes }) => {
    const payload = structuredClone(base === 'month' ? month : SYNTHETIC_SESSION);
    for (const [path, value] of changes) {
      const keys = path as (string | number)[];
      let target: unknown = payload;
      for (const key of keys.slice(0, -1)) target = (target as Record<string | number, unknown>)[key];
      (target as Record<string | number, unknown>)[keys.at(-1)!] = value;
    }
    expect(() => parseOperations(payload)).toThrow('Invalid public operations');
  });
  it('accepts a real typed runtime receipt rather than rejecting all activation records', () => {
    const payload = structuredClone(month);
    payload.evidence[0]!.kind = 'runtime-receipt';
    payload.strategies.value[0]!.authority = 'runtime-receipt';
    Object.assign(payload.strategies.value[0]!.activationObservedAt, {
      availability: 'recorded',
      value: payload.sourceAsOf,
      evidenceIds: ['policy'],
    });
    expect(parseOperations(payload)).toEqual(payload);
  });
  it('parses a registered policy without claiming runtime activation', () => {
    const parsed = parseOperations(month);
    expect(parsed.recordType).toBe('month');
    if (parsed.recordType === 'month') expect(parsed.strategies.value?.[0]?.activationObservedAt.value).toBeNull();
  });
  it.each([
    { ...month, mode: 'live' },
    { ...month, privatePath: '/home/private' },
    { ...month, sourceAsOf: '2026-09-18T14:00:01+00:00' },
    { ...month, strategies: { ...month.strategies, evidenceIds: ['missing'] } },
  ])('rejects a malformed entire payload', payload => {
    expect(() => parseOperations(payload)).toThrow('Invalid public operations');
  });
});
