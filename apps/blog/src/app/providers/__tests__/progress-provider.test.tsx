import { act, render, screen } from '@testing-library/react';

import { ProgressProvider } from '../progress-provider';

import '@testing-library/jest-dom';

type MatchMediaListener = (event: MediaQueryListEvent) => void;

jest.mock('@bprogress/next/app', () => ({
  ProgressProvider: ({
    children,
    color,
    height,
    delay,
    stopDelay,
    options,
    shallowRouting,
  }: {
    children: React.ReactNode;
    color?: string;
    height?: string;
    delay?: number;
    stopDelay?: number;
    options?: Record<string, unknown>;
    shallowRouting?: boolean;
  }) => (
    <div
      data-testid="bprogress-provider"
      data-color={color}
      data-height={height}
      data-delay={delay}
      data-stop-delay={stopDelay}
      data-shallow-routing={String(shallowRouting)}
      data-easing={options?.easing as string | undefined}
      data-speed={options?.speed as number | undefined}
      data-trickle={String(options?.trickle)}
      data-show-spinner={String(options?.showSpinner)}
    >
      {children}
    </div>
  ),
}));

function mockMatchMedia(matches: boolean) {
  const listeners: MatchMediaListener[] = [];
  const removeEventListener = jest.fn((_: string, cb: MatchMediaListener) => {
    const idx = listeners.indexOf(cb);
    if (idx !== -1) listeners.splice(idx, 1);
  });
  const addEventListener = jest.fn((_: string, cb: MatchMediaListener) => {
    listeners.push(cb);
  });
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener,
      removeEventListener,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
  return { listeners, addEventListener, removeEventListener };
}

function emitReducedMotionChange(listeners: MatchMediaListener[], matches: boolean) {
  act(() => {
    listeners.forEach(listener => listener({ matches } as MediaQueryListEvent));
  });
}

describe('ProgressProvider', () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  it('should render children', () => {
    render(
      <ProgressProvider>
        <div data-testid="content">child</div>
      </ProgressProvider>
    );

    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('should pass theme-aware color and bar height to the underlying provider', () => {
    render(
      <ProgressProvider>
        <span>x</span>
      </ProgressProvider>
    );

    const provider = screen.getByTestId('bprogress-provider');
    expect(provider).toHaveAttribute('data-color', 'var(--primary)');
    expect(provider).toHaveAttribute('data-height', '2px');
  });

  it('should configure debounced start/stop to avoid flicker on fast transitions', () => {
    render(
      <ProgressProvider>
        <span>x</span>
      </ProgressProvider>
    );

    const provider = screen.getByTestId('bprogress-provider');
    expect(Number(provider.getAttribute('data-delay'))).toBeGreaterThan(0);
    expect(Number(provider.getAttribute('data-stop-delay'))).toBeGreaterThanOrEqual(0);
  });

  it('should hide the spinner and rely only on the top bar', () => {
    render(
      <ProgressProvider>
        <span>x</span>
      </ProgressProvider>
    );

    expect(screen.getByTestId('bprogress-provider')).toHaveAttribute('data-show-spinner', 'false');
  });

  it('should enable trickle animation when reduced motion is not preferred', () => {
    mockMatchMedia(false);

    render(
      <ProgressProvider>
        <span>x</span>
      </ProgressProvider>
    );

    const provider = screen.getByTestId('bprogress-provider');
    expect(provider).toHaveAttribute('data-trickle', 'true');
    expect(provider).toHaveAttribute('data-easing', 'ease');
  });

  it('should disable trickle animation when reduced motion is preferred', () => {
    mockMatchMedia(true);

    render(
      <ProgressProvider>
        <span>x</span>
      </ProgressProvider>
    );

    const provider = screen.getByTestId('bprogress-provider');
    expect(provider).toHaveAttribute('data-trickle', 'false');
    expect(provider).toHaveAttribute('data-easing', 'linear');
    expect(provider).toHaveAttribute('data-speed', '0');
  });

  it('should register a change listener on the reduced-motion media query', () => {
    const { addEventListener } = mockMatchMedia(false);

    render(
      <ProgressProvider>
        <span>x</span>
      </ProgressProvider>
    );

    expect(addEventListener).toHaveBeenCalledTimes(1);
    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('should react to reduced-motion changes after mount', () => {
    const { listeners } = mockMatchMedia(false);

    render(
      <ProgressProvider>
        <span>x</span>
      </ProgressProvider>
    );

    const provider = screen.getByTestId('bprogress-provider');
    expect(provider).toHaveAttribute('data-trickle', 'true');
    expect(provider).toHaveAttribute('data-easing', 'ease');

    emitReducedMotionChange(listeners, true);

    expect(provider).toHaveAttribute('data-trickle', 'false');
    expect(provider).toHaveAttribute('data-easing', 'linear');
    expect(provider).toHaveAttribute('data-speed', '0');

    emitReducedMotionChange(listeners, false);

    expect(provider).toHaveAttribute('data-trickle', 'true');
    expect(provider).toHaveAttribute('data-easing', 'ease');
  });

  it('should remove the change listener on unmount with the same handler', () => {
    const { addEventListener, removeEventListener } = mockMatchMedia(false);

    const { unmount } = render(
      <ProgressProvider>
        <span>x</span>
      </ProgressProvider>
    );

    const registeredHandler = addEventListener.mock.calls[0]?.[1];

    unmount();

    expect(removeEventListener).toHaveBeenCalledTimes(1);
    expect(removeEventListener).toHaveBeenCalledWith('change', registeredHandler);
  });
});
