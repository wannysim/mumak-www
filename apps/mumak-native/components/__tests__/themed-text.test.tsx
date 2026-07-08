import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ThemedText } from '../themed-text';

describe('ThemedText', () => {
  it('renders its children', () => {
    render(<ThemedText>Hello</ThemedText>);
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('applies the title style for type="title"', () => {
    render(<ThemedText type="title">Title</ThemedText>);
    const flat = StyleSheet.flatten(screen.getByText('Title').props.style);
    expect(flat).toEqual(expect.objectContaining({ fontSize: 32, fontWeight: 'bold' }));
  });

  it.each([
    ['defaultSemiBold', { fontWeight: '600' }],
    ['subtitle', { fontSize: 20 }],
    ['link', { color: '#0a7ea4' }],
  ] as const)('applies the %s style variant', (type, expected) => {
    render(<ThemedText type={type}>{type}</ThemedText>);
    const flat = StyleSheet.flatten(screen.getByText(type).props.style);
    expect(flat).toEqual(expect.objectContaining(expected));
  });

  it('exposes a heading role when requested', () => {
    render(
      <ThemedText type="title" accessibilityRole="header">
        Home
      </ThemedText>
    );
    expect(screen.getByRole('header', { name: 'Home' })).toBeTruthy();
  });
});
