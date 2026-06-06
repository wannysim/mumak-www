import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import { HapticTab } from '../haptic-tab';

const originalExpoOS = process.env.EXPO_OS;

function renderHapticTab(props: Partial<React.ComponentProps<typeof HapticTab>> = {}) {
  return render(<HapticTab accessibilityRole="button" {...(props as React.ComponentProps<typeof HapticTab>)} />);
}

describe('HapticTab', () => {
  afterEach(() => {
    process.env.EXPO_OS = originalExpoOS;
    jest.clearAllMocks();
  });

  it('runs light haptic feedback on iOS press in', () => {
    const onPressIn = jest.fn();
    process.env.EXPO_OS = 'ios';

    renderHapticTab({ onPressIn });
    fireEvent(screen.getByRole('button'), 'pressIn', { nativeEvent: {} });

    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    expect(onPressIn).toHaveBeenCalled();
  });
});
