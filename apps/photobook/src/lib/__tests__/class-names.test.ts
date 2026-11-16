import { describe, expect, it } from 'vitest';

import { joinClassNames } from '../class-names';

describe('joinClassNames', () => {
  it('should join the given names and skip empty ones', () => {
    expect(joinClassNames('book', undefined, false, null, '', 'extra')).toBe('book extra');
    expect(joinClassNames()).toBe('');
  });
});
