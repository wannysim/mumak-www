import { Env, resolveEnvironment } from '@/constants/env';

describe('resolveEnvironment', () => {
  it('uses an explicit valid EXPO_PUBLIC_APP_ENV', () => {
    expect(resolveEnvironment('preview', false)).toBe('preview');
    expect(resolveEnvironment('production', true)).toBe('production');
  });

  it('falls back to development in dev when unset', () => {
    expect(resolveEnvironment(undefined, true)).toBe('development');
  });

  it('falls back to production outside dev when unset', () => {
    expect(resolveEnvironment(undefined, false)).toBe('production');
  });

  it('throws on an unknown environment value', () => {
    expect(() => resolveEnvironment('staging', true)).toThrow(/Invalid EXPO_PUBLIC_APP_ENV/);
  });
});

describe('Env', () => {
  it('exposes a valid resolved environment', () => {
    expect(['development', 'preview', 'production']).toContain(Env.environment);
  });

  it('exposes apiBaseUrl as a string or undefined', () => {
    expect(['string', 'undefined']).toContain(typeof Env.apiBaseUrl);
  });
});
