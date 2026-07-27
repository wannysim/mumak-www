import { render, screen } from '@testing-library/react-native';
import { DarkTheme, DefaultTheme } from 'expo-router';

import { useColorScheme } from '@/hooks/use-color-scheme';

import RootLayout, { ErrorBoundary, unstable_settings } from '../_layout';

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

  it('re-exports the route error boundary', () => {
    expect(ErrorBoundary).toBeInstanceOf(Function);
  });

  it('renders the stack inside the safe area + light theme providers', async () => {
    await render(<RootLayout />);

    expect(screen.getByTestId('safe-area-provider')).toBeTruthy();
    expect(screen.getByTestId('theme-provider').props.value).toBe(DefaultTheme);
    expect(screen.getByTestId('status-bar').props.style).toBe('auto');

    const [tabs, notFound] = screen.getAllByTestId('stack-screen');
    expect(tabs.props.accessibilityLabel).toBe('(tabs)');
    expect(tabs.props.options).toEqual({ headerShown: false });
    expect(notFound.props.accessibilityLabel).toBe('+not-found');
    expect(notFound.props.options).toEqual({ title: 'Oops!' });
  });

  it('switches to the dark theme when the device is dark', async () => {
    mockedUseColorScheme.mockReturnValue('dark');

    await render(<RootLayout />);

    expect(screen.getByTestId('theme-provider').props.value).toBe(DarkTheme);
  });
});
