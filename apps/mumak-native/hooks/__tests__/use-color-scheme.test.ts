import { renderHook } from '@testing-library/react-native';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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
  const getColorScheme = jest.spyOn(ReactNative.Appearance, 'getColorScheme');
  const addChangeListener = jest
    .spyOn(ReactNative.Appearance, 'addChangeListener')
    .mockReturnValue({ remove: jest.fn() });

  afterEach(() => {
    getColorScheme.mockReset();
    addChangeListener.mockClear();
  });

  it('follows a dark client scheme', () => {
    getColorScheme.mockReturnValue('dark');

    const { result } = renderHook(() => useWebColorScheme());

    expect(result.current).toBe('dark');
  });

  it('falls back to light when the client scheme is not dark', () => {
    getColorScheme.mockReturnValue('light');

    const { result } = renderHook(() => useWebColorScheme());

    expect(result.current).toBe('light');
  });

  it('pins the server snapshot to light during static rendering', () => {
    const html = renderToStaticMarkup(createElement(() => createElement('span', null, useWebColorScheme())));

    expect(html).toBe('<span>light</span>');
  });
});
