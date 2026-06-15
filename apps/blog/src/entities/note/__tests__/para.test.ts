import { isValidParaCategory, PARA_CATEGORY_KEYS, PARA_LABELS } from '../para';

describe('PARA categories', () => {
  it('accepts every configured PARA category key', () => {
    for (const key of PARA_CATEGORY_KEYS) {
      expect(isValidParaCategory(key)).toBe(true);
      expect(PARA_LABELS[key]).toBeTruthy();
    }
  });

  it('rejects unknown category keys', () => {
    expect(isValidParaCategory('garden')).toBe(false);
    expect(isValidParaCategory('')).toBe(false);
  });
});
