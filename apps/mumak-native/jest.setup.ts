// React Native + Expo Jest setup (jest-expo SDK 56 + jest 29).
// Mocks applied per test file. Extend as components start exercising real router/haptics behavior.

jest.mock('react-native-reanimated', () => ({}));

const mockCreateNavigator = (testID: string) => {
  const React = require('react');
  const { View } = require('react-native');

  const Navigator = ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement(View, { testID, ...props }, children);

  Navigator.Screen = ({ name, options }: { name: string; options?: unknown }) =>
    React.createElement(View, { accessibilityLabel: name, options, testID: `${testID}-screen` });

  return Navigator;
};

jest.mock('expo-router', () => ({
  DarkTheme: { dark: true },
  DefaultTheme: { dark: false },
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
    setParams: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  usePathname: () => '/',
  useSegments: () => [],
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: mockCreateNavigator('stack'),
  Tabs: mockCreateNavigator('tabs'),
  ThemeProvider: ({ children, value }: { children: React.ReactNode; value: unknown }) => {
    const React = require('react');
    const { View } = require('react-native');

    return React.createElement(View, { testID: 'theme-provider', value }, children);
  },
}));

jest.mock('expo-router/react-navigation', () => {
  const { Pressable } = require('react-native');

  return { PlatformPressable: Pressable };
});

jest.mock('expo-status-bar', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    StatusBar: (props: Record<string, unknown>) => React.createElement(View, { testID: 'status-bar', ...props }),
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));
