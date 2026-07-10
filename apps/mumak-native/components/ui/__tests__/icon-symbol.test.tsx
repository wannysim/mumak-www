import { render, screen } from '@testing-library/react-native';

import { IconSymbol } from '../icon-symbol';

jest.mock('@expo/vector-icons/MaterialIcons', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MaterialIcons(props: Record<string, unknown>) {
    return React.createElement(Text, { testID: 'material-icon', ...props }, props.name);
  };
});

describe('IconSymbol', () => {
  it('maps SF Symbol names to Material Icon names', () => {
    render(<IconSymbol name="paperplane.fill" color="#123456" size={32} style={{ opacity: 0.5 }} />);

    const icon = screen.getByTestId('material-icon');
    expect(icon.props.name).toBe('send');
    expect(icon.props.color).toBe('#123456');
    expect(icon.props.size).toBe(32);
    expect(icon.props.style).toEqual({ opacity: 0.5 });
  });

  it('defaults the icon size to 24 when none is given', () => {
    render(<IconSymbol name="house.fill" color="#123456" />);

    expect(screen.getByTestId('material-icon').props.size).toBe(24);
  });
});
