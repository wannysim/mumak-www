import { describe, expect, it } from 'vitest';

import { formatFolio, formatPageNumber, formatPageSpan } from '../folio';

describe('folio', () => {
  it('should pad page numbers to two digits', () => {
    expect(formatPageNumber(4)).toBe('04');
    expect(formatPageNumber(24)).toBe('24');
  });

  it('should join a spread with an en dash and append the total', () => {
    expect(formatPageSpan([3, 4])).toBe('03–04');
    expect(formatFolio([4, 5], 24)).toBe('04–05/24');
    expect(formatFolio([5], 8)).toBe('05/08');
  });
});
