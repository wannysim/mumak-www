import { describe, expect, it } from 'vitest';

import { formatTime } from '../lib/format-time';

describe('formatTime', () => {
  it('formats seconds as m:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(9)).toBe('0:09');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(224)).toBe('3:44');
  });

  it('truncates fractions instead of rounding up', () => {
    // 3:44.9를 3:45로 보여 주면 끝나기 전에 끝난 것처럼 보인다.
    expect(formatTime(59.9)).toBe('0:59');
  });

  it('goes past an hour without breaking', () => {
    expect(formatTime(3661)).toBe('61:01');
  });

  it('shows a placeholder for unknown values', () => {
    expect(formatTime(Number.NaN)).toBe('--:--');
    expect(formatTime(-1)).toBe('--:--');
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe('--:--');
  });
});
