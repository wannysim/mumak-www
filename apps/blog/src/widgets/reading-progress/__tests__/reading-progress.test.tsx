import { render, screen } from '@testing-library/react';

import { ReadingProgress } from '../ui/reading-progress';

import '@testing-library/jest-dom';

const mockUseScrollProgress = jest.fn(() => 0);

jest.mock('@/src/shared/hooks', () => ({
  useScrollProgress: () => mockUseScrollProgress(),
}));

describe('ReadingProgress', () => {
  beforeEach(() => {
    mockUseScrollProgress.mockReturnValue(0);
  });

  it('renders a progressbar with min/max range', () => {
    render(<ReadingProgress />);

    const bar = screen.getByRole('progressbar', { name: 'Reading progress' });
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it.each([
    [0, '0', 'scaleX(0)'],
    [37.4, '37', 'scaleX(0.374)'],
    [100, '100', 'scaleX(1)'],
  ])('reflects progress %s as aria-valuenow=%s and transform=%s', (progress, ariaNow, transform) => {
    mockUseScrollProgress.mockReturnValue(progress);

    render(<ReadingProgress />);

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', ariaNow);
    expect(bar.querySelector('div')).toHaveStyle({ transform });
  });

  it('rounds aria-valuenow to nearest integer', () => {
    mockUseScrollProgress.mockReturnValue(42.7);

    render(<ReadingProgress />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '43');
  });

  it('appends custom className to the wrapper', () => {
    mockUseScrollProgress.mockReturnValue(50);

    render(<ReadingProgress className="custom-extra" />);

    expect(screen.getByRole('progressbar')).toHaveClass('custom-extra');
  });
});
