// React Native + Expo Jest setup.
// Mocks applied per test file. Extend as components start exercising real router/haptics behavior.

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('expo-router', () => ({
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
  Stack: { Screen: () => null },
  Tabs: { Screen: () => null },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));
