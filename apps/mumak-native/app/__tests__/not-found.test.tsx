import { render, screen } from '@testing-library/react-native';

import NotFoundScreen from '../+not-found';

describe('NotFoundScreen', () => {
  it('renders the not-found message and a link home', async () => {
    await render(<NotFoundScreen />);

    expect(screen.getByText('이 화면은 존재하지 않아요.')).toBeTruthy();
    expect(screen.getByText('홈으로 돌아가기')).toBeTruthy();
  });
});
