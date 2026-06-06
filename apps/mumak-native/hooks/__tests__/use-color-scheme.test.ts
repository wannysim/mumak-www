import { renderHook, waitFor } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

import { useColorScheme } from '../use-color-scheme';
import { useColorScheme as useWebColorScheme } from '../use-color-scheme.web';

const mockedUseRNColorScheme = jest.spyOn(ReactNative, 'useColorScheme');

describe('useColorScheme', () => {
  afterEach(() => {
    mockedUseRNColorScheme.mockReset();
  });

  it('returns dark only when React Native reports dark', () => {
    mockedUseRNColorScheme.mockReturnValue('dark');

    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe('dark');
  });

  it('falls back to light when no dark scheme is reported', () => {
    mockedUseRNColorScheme.mockReturnValue('light');

    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe('light');
  });
});

describe('useColorScheme.web', () => {
  afterEach(() => {
    mockedUseRNColorScheme.mockReset();
  });

  it('returns light before hydration and then follows a dark client scheme', async () => {
    mockedUseRNColorScheme.mockReturnValue('dark');

    const { result } = renderHook(() => useWebColorScheme());

    await waitFor(() => expect(result.current).toBe('dark'));
  });

  it('keeps light after hydration when the client scheme is not dark', async () => {
    mockedUseRNColorScheme.mockReturnValue('light');

    const { result } = renderHook(() => useWebColorScheme());

    await waitFor(() => expect(result.current).toBe('light'));
  });
});
