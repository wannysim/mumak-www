import { render, screen } from '@testing-library/react';

import { HeaderSpacer, SmartHeader } from '../ui/smart-header';

import '@testing-library/jest-dom';

// Mock useScrollDirection hook
const mockUseScrollDirection = jest.fn();
jest.mock('@/src/shared/hooks', () => ({
  useScrollDirection: () => mockUseScrollDirection(),
}));

describe('SmartHeader', () => {
  beforeEach(() => {
    mockUseScrollDirection.mockReturnValue({
      isVisible: true,
      isAtTop: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders children correctly', () => {
      render(
        <SmartHeader>
          <nav>Navigation Content</nav>
        </SmartHeader>
      );

      expect(screen.getByText('Navigation Content')).toBeInTheDocument();
    });

    it('renders as a header element', () => {
      render(
        <SmartHeader>
          <nav>Test</nav>
        </SmartHeader>
      );

      expect(screen.getByRole('banner')).toBeInTheDocument();
    });
  });

  describe('Visibility state', () => {
    it('applies translate-y-0 class when visible', () => {
      mockUseScrollDirection.mockReturnValue({
        isVisible: true,
        isAtTop: true,
      });

      render(
        <SmartHeader>
          <nav>Test</nav>
        </SmartHeader>
      );

      const header = screen.getByRole('banner');
      expect(header).toHaveClass('translate-y-0');
      expect(header).not.toHaveClass('-translate-y-full');
    });

    it('applies -translate-y-full class when hidden', () => {
      mockUseScrollDirection.mockReturnValue({
        isVisible: false,
        isAtTop: false,
      });

      render(
        <SmartHeader>
          <nav>Test</nav>
        </SmartHeader>
      );

      const header = screen.getByRole('banner');
      expect(header).toHaveClass('-translate-y-full');
      expect(header).not.toHaveClass('translate-y-0');
    });
  });

  describe('Shadow state', () => {
    it('has no shadow when at top (isAtTop=true)', () => {
      mockUseScrollDirection.mockReturnValue({
        isVisible: true,
        isAtTop: true,
      });

      render(
        <SmartHeader>
          <nav>Test</nav>
        </SmartHeader>
      );

      const header = screen.getByRole('banner');
      expect(header).not.toHaveClass('shadow-sm');
    });

    it('shows shadow after scrolling (isAtTop=false)', () => {
      mockUseScrollDirection.mockReturnValue({
        isVisible: true,
        isAtTop: false,
      });

      render(
        <SmartHeader>
          <nav>Test</nav>
        </SmartHeader>
      );

      const header = screen.getByRole('banner');
      expect(header).toHaveClass('shadow-sm');
    });
  });

  describe('Styling', () => {
    it('applies fixed position classes', () => {
      render(
        <SmartHeader>
          <nav>Test</nav>
        </SmartHeader>
      );

      const header = screen.getByRole('banner');
      expect(header).toHaveClass('fixed', 'top-0', 'left-0', 'right-0', 'z-50');
    });

    it('has no backdrop-blur when at top for Safari iOS theme-color compatibility', () => {
      mockUseScrollDirection.mockReturnValue({
        isVisible: true,
        isAtTop: true,
      });

      render(
        <SmartHeader>
          <nav>Test</nav>
        </SmartHeader>
      );

      const header = screen.getByRole('banner');
      expect(header).toHaveClass('bg-background');
      expect(header).not.toHaveClass('backdrop-blur-sm');
    });

    it('applies backdrop-blur after scrolling (isAtTop=false)', () => {
      mockUseScrollDirection.mockReturnValue({
        isVisible: true,
        isAtTop: false,
      });

      render(
        <SmartHeader>
          <nav>Test</nav>
        </SmartHeader>
      );

      const header = screen.getByRole('banner');
      expect(header).toHaveClass('backdrop-blur-sm');
    });

    it('applies transition classes', () => {
      render(
        <SmartHeader>
          <nav>Test</nav>
        </SmartHeader>
      );

      const header = screen.getByRole('banner');
      expect(header).toHaveClass('transition-transform', 'duration-300');
    });
  });

  describe('Data attributes', () => {
    it('data-visible attribute reflects the state', () => {
      mockUseScrollDirection.mockReturnValue({
        isVisible: true,
        isAtTop: true,
      });

      render(
        <SmartHeader>
          <nav>Test</nav>
        </SmartHeader>
      );

      const header = screen.getByRole('banner');
      expect(header).toHaveAttribute('data-visible', 'true');
    });

    it('data-at-top attribute reflects the state', () => {
      mockUseScrollDirection.mockReturnValue({
        isVisible: true,
        isAtTop: false,
      });

      render(
        <SmartHeader>
          <nav>Test</nav>
        </SmartHeader>
      );

      const header = screen.getByRole('banner');
      expect(header).toHaveAttribute('data-at-top', 'false');
    });
  });
});

describe('HeaderSpacer', () => {
  it('renders a div with height 16 (h-16)', () => {
    const { container } = render(<HeaderSpacer />);

    const spacer = container.firstChild;
    expect(spacer).toHaveClass('h-16');
  });

  it('has aria-hidden attribute set to true', () => {
    const { container } = render(<HeaderSpacer />);

    const spacer = container.firstChild;
    expect(spacer).toHaveAttribute('aria-hidden', 'true');
  });
});
