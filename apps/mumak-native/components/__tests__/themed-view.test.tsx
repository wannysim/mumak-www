import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/theme';

import { ThemedView } from '../themed-view';

describe('ThemedView', () => {
  it('applies the themed background color', () => {
    render(<ThemedView testID="tv" />);
    const flat = StyleSheet.flatten(screen.getByTestId('tv').props.style);
    expect(flat.backgroundColor).toBe(Colors.light.background);
  });

  it('honors an explicit lightColor override', () => {
    render(<ThemedView testID="tv" lightColor="#abcabc" />);
    const flat = StyleSheet.flatten(screen.getByTestId('tv').props.style);
    expect(flat.backgroundColor).toBe('#abcabc');
  });
});
