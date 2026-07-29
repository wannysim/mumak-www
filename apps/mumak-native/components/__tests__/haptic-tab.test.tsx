import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { HapticTab } from '../haptic-tab';

const originalOS = Platform.OS;

function renderHapticTab(props: Partial<React.ComponentProps<typeof HapticTab>> = {}) {
  return render(<HapticTab accessibilityRole="button" {...(props as React.ComponentProps<typeof HapticTab>)} />);
}

describe('HapticTab', () => {
  afterEach(() => {
    Platform.OS = originalOS;
    jest.clearAllMocks();
  });

  it('runs light haptic feedback on iOS press in', async () => {
    const onPressIn = jest.fn();
    Platform.OS = 'ios';

    await renderHapticTab({ onPressIn });
    await fireEvent(screen.getByRole('button'), 'pressIn', { nativeEvent: {} });

    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    expect(onPressIn).toHaveBeenCalled();
  });

  it('skips haptic feedback off iOS but still forwards the press', async () => {
    const onPressIn = jest.fn();
    Platform.OS = 'android';

    await renderHapticTab({ onPressIn });
    await fireEvent(screen.getByRole('button'), 'pressIn', { nativeEvent: {} });

    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(onPressIn).toHaveBeenCalled();
  });
});
