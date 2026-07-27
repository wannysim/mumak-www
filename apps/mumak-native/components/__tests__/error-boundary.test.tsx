import { fireEvent, render, screen } from '@testing-library/react-native';

import { ErrorBoundary } from '@/components/error-boundary';

describe('ErrorBoundary', () => {
  it('shows the error message and a retry control', async () => {
    await render(<ErrorBoundary error={new Error('boom')} retry={jest.fn()} />);

    expect(screen.getByText('문제가 발생했어요')).toBeTruthy();
    expect(screen.getByText('boom')).toBeTruthy();
    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('invokes retry when the button is pressed', async () => {
    const retry = jest.fn();
    await render(<ErrorBoundary error={new Error('boom')} retry={retry} />);

    await fireEvent.press(screen.getByRole('button'));

    expect(retry).toHaveBeenCalledTimes(1);
  });
});
