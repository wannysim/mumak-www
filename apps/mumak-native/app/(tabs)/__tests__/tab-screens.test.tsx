import { render, screen } from '@testing-library/react-native';

import ExploreScreen from '../explore';
import HomeScreen from '../index';

describe('tab screens', () => {
  it('renders the home placeholder screen', () => {
    render(<HomeScreen />);

    expect(screen.getByRole('header', { name: 'Home' })).toBeTruthy();
    expect(screen.getByText('Edit app/(tabs)/index.tsx to start building.')).toBeTruthy();
  });

  it('renders the explore placeholder screen', () => {
    render(<ExploreScreen />);

    expect(screen.getByRole('header', { name: 'Explore' })).toBeTruthy();
    expect(screen.getByText('Second tab placeholder.')).toBeTruthy();
  });
});
