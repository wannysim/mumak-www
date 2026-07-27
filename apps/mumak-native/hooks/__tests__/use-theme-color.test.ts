import { renderHook } from '@testing-library/react-native';

import { Colors } from '@/constants/theme';

import { useThemeColor } from '../use-theme-color';

describe('useThemeColor', () => {
  it('returns the light token by default', async () => {
    const { result } = await renderHook(() => useThemeColor({}, 'background'));
    expect(result.current).toBe(Colors.light.background);
  });

  it('prefers an explicit override color', async () => {
    const { result } = await renderHook(() => useThemeColor({ light: '#abcabc' }, 'background'));
    expect(result.current).toBe('#abcabc');
  });
});
