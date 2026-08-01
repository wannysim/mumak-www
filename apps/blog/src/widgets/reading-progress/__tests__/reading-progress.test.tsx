import { render, screen } from '@testing-library/react';

import { ReadingProgress } from '../ui/reading-progress';

import '@testing-library/jest-dom';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

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

    const bar = screen.getByRole('progressbar', { name: 'readingProgress' });
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it.each([
    [0, '0'],
    [37.4, '37'],
    [100, '100'],
  ])('reflects progress %s as aria-valuenow and value %s', (progress, expected) => {
    mockUseScrollProgress.mockReturnValue(progress);

    render(<ReadingProgress />);

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', expected);
    expect(bar).toHaveAttribute('value', expected);
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
