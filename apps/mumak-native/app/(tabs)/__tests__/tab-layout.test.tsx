import { render, screen } from '@testing-library/react-native';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

import TabLayout from '../_layout';

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: jest.fn(),
}));

const mockedUseColorScheme = jest.mocked(useColorScheme);

describe('TabLayout', () => {
  beforeEach(() => {
    mockedUseColorScheme.mockReturnValue('light');
  });

  it('configures tabs with the current theme and haptic tab button', () => {
    render(<TabLayout />);

    const tabs = screen.getByTestId('tabs');
    expect(tabs.props.screenOptions).toEqual(
      expect.objectContaining({
        headerShown: false,
        tabBarActiveTintColor: Colors.light.tint,
        tabBarButton: HapticTab,
      })
    );
  });

  it('registers home and explore tab screens', () => {
    render(<TabLayout />);

    const [home, explore] = screen.getAllByTestId('tabs-screen');
    expect(home.props.accessibilityLabel).toBe('index');
    expect(home.props.options.title).toBe('Home');
    expect(home.props.options.tabBarIcon({ color: '#123456' }).props).toEqual(
      expect.objectContaining({ color: '#123456', name: 'house.fill', size: 28 })
    );

    expect(explore.props.accessibilityLabel).toBe('explore');
    expect(explore.props.options.title).toBe('Explore');
    expect(explore.props.options.tabBarIcon({ color: '#654321' }).props).toEqual(
      expect.objectContaining({ color: '#654321', name: 'paperplane.fill', size: 28 })
    );
  });

  it('uses the dark tab tint when the device is dark', () => {
    mockedUseColorScheme.mockReturnValue('dark');

    render(<TabLayout />);

    expect(screen.getByTestId('tabs').props.screenOptions.tabBarActiveTintColor).toBe(Colors.dark.tint);
  });
});
