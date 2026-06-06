import { defaultLocale, isValidLocale, type Locale, locales } from '../config';

describe('i18n Configuration', () => {
  describe('locales', () => {
    it('should have ko and en as supported locales', () => {
      expect(locales).toContain('ko');
      expect(locales).toContain('en');
      expect(locales).toHaveLength(2);
    });

    it('should have ko as the default locale', () => {
      expect(defaultLocale).toBe('ko');
    });
  });

  describe('Locale type', () => {
    it('should accept valid locales', () => {
      const ko: Locale = 'ko';
      const en: Locale = 'en';
      expect(ko).toBe('ko');
      expect(en).toBe('en');
    });
  });

  describe('isValidLocale', () => {
    it('should return true for valid locales', () => {
      expect(isValidLocale('ko')).toBe(true);
      expect(isValidLocale('en')).toBe(true);
    });

    it('should return false for invalid locales', () => {
      expect(isValidLocale('fr')).toBe(false);
      expect(isValidLocale('ja')).toBe(false);
      expect(isValidLocale('')).toBe(false);
      expect(isValidLocale('invalid')).toBe(false);
    });
  });
});
