import { render, screen } from '@testing-library/react-native';
import { DarkTheme, DefaultTheme } from 'expo-router';

import { useColorScheme } from '@/hooks/use-color-scheme';

import RootLayout, { unstable_settings } from '../_layout';

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: jest.fn(),
}));

const mockedUseColorScheme = jest.mocked(useColorScheme);

describe('RootLayout', () => {
  beforeEach(() => {
    mockedUseColorScheme.mockReturnValue('light');
  });

  it('anchors expo-router to the tab group', () => {
    expect(unstable_settings).toEqual({ anchor: '(tabs)' });
  });

  it('renders the tab stack inside the light theme', () => {
    render(<RootLayout />);

    expect(screen.getByTestId('theme-provider').props.value).toBe(DefaultTheme);
    expect(screen.getByTestId('stack-screen').props.accessibilityLabel).toBe('(tabs)');
    expect(screen.getByTestId('stack-screen').props.options).toEqual({ headerShown: false });
    expect(screen.getByTestId('status-bar').props.style).toBe('auto');
  });

  it('switches to the dark theme when the device is dark', () => {
    mockedUseColorScheme.mockReturnValue('dark');

    render(<RootLayout />);

    expect(screen.getByTestId('theme-provider').props.value).toBe(DarkTheme);
  });
});
