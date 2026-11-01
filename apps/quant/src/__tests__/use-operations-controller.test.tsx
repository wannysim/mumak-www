import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { useOperationsQuery } from '../hooks/use-operations-controller';

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});
it('does not query hidden pages, resumes, and erases failed data', async () => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  const load = vi.fn(async (_signal: AbortSignal) => 'saved');
  const { result } = renderHook(() => useOperationsQuery('synthetic', load));
  expect(load).not.toHaveBeenCalled();
  act(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await waitFor(() => expect(result.current.data).toBe('saved'));
  load.mockRejectedValueOnce(new Error('PRIVATE'));
  await act(async () => {
    await result.current.retry();
  });
  expect(result.current.data).toBeNull();
  expect(result.current.status).toBe('error');
});
it('discards old identity and reverse-order responses even if transport ignores abort', async () => {
  let resolveOld: (value: string) => void = () => {};
  const old = vi.fn(
    (_signal: AbortSignal) =>
      new Promise<string>(resolve => {
        resolveOld = resolve;
      })
  );
  const fresh = vi.fn(async (_signal: AbortSignal) => 'fresh');
  const { result, rerender } = renderHook(({ key, load }) => useOperationsQuery(key, load), {
    initialProps: { key: 'old', load: old as (signal: AbortSignal) => Promise<string> },
  });
  rerender({ key: 'new', load: fresh });
  await waitFor(() => expect(result.current.data).toBe('fresh'));
  await act(async () => {
    resolveOld('old');
  });
  expect(result.current.data).toBe('fresh');
});
