import { render, screen } from '@testing-library/react-native';
import { DarkTheme, DefaultTheme } from 'expo-router';
import { Text } from 'react-native';

import { AppProviders } from '@/components/providers';
import { useColorScheme } from '@/hooks/use-color-scheme';

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: jest.fn(),
}));

const mockedUseColorScheme = jest.mocked(useColorScheme);

describe('AppProviders', () => {
  beforeEach(() => {
    mockedUseColorScheme.mockReturnValue('light');
  });

  it('wraps children in safe area + light theme providers', async () => {
    await render(
      <AppProviders>
        <Text>child</Text>
      </AppProviders>
    );

    expect(screen.getByTestId('safe-area-provider')).toBeTruthy();
    expect(screen.getByTestId('theme-provider').props.value).toBe(DefaultTheme);
    expect(screen.getByText('child')).toBeTruthy();
  });

  it('applies the dark theme when the device is dark', async () => {
    mockedUseColorScheme.mockReturnValue('dark');

    await render(
      <AppProviders>
        <Text>child</Text>
      </AppProviders>
    );

    expect(screen.getByTestId('theme-provider').props.value).toBe(DarkTheme);
  });
});
