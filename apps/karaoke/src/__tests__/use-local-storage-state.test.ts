import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useLocalStorageState } from '../hooks/use-local-storage-state';

describe('useLocalStorageState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('falls back when nothing is stored', () => {
    const { result } = renderHook(() => useLocalStorageState('k', 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });

  it('persists updates to localStorage', () => {
    const { result } = renderHook(() => useLocalStorageState('k', 'a'));
    act(() => result.current[1]('b'));
    expect(localStorage.getItem('k')).toBe('"b"');
  });

  it('reads the stored value back', () => {
    localStorage.setItem('k', '{"jp":false}');
    const { result } = renderHook(() => useLocalStorageState('k', { jp: true }));
    expect(result.current[0]).toEqual({ jp: false });
  });

  it('falls back on corrupt JSON', () => {
    localStorage.setItem('k', '{oops');
    const { result } = renderHook(() => useLocalStorageState('k', 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });
});
