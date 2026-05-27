import { act, render, screen } from '@testing-library/react';

import { ProgressProvider } from '../progress-provider';

import '@testing-library/jest-dom';

type MatchMediaListener = (event: MediaQueryListEvent) => void;

let mockPathname = '/ko/garden';
let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
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
    jest.useFakeTimers();
    mockMatchMedia(false);
    mockPathname = '/ko/garden';
    mockSearchParams = new URLSearchParams();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('should render children', () => {
    render(
      <ProgressProvider>
        <div data-testid="content">child</div>
      </ProgressProvider>
    );

    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('should not render the progress bar on first mount', () => {
    render(
      <ProgressProvider>
        <span>x</span>
      </ProgressProvider>
    );

    expect(screen.queryByTestId('page-transition-progress')).not.toBeInTheDocument();
  });

  it('should not attach any document-level click or popstate handlers', () => {
    const addDocumentListenerSpy = jest.spyOn(document, 'addEventListener');
    const addWindowListenerSpy = jest.spyOn(window, 'addEventListener');

    render(
      <ProgressProvider>
        <span>x</span>
      </ProgressProvider>
    );

    const interceptedEvents = ['click', 'popstate', 'pushstate', 'replacestate'];
    const documentHits = addDocumentListenerSpy.mock.calls.filter(([type]) =>
      interceptedEvents.includes(String(type).toLowerCase())
    );
    const windowHits = addWindowListenerSpy.mock.calls.filter(([type]) =>
      interceptedEvents.includes(String(type).toLowerCase())
    );

    expect(documentHits).toHaveLength(0);
    expect(windowHits).toHaveLength(0);

    addDocumentListenerSpy.mockRestore();
    addWindowListenerSpy.mockRestore();
  });

  describe('on navigation', () => {
    it('should render the bar with accent color and stay at top with elevated z-index', () => {
      const { rerender } = render(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      mockPathname = '/ko/garden/pkm';
      rerender(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      const bar = screen.getByTestId('page-transition-progress');
      expect(bar).toHaveClass('fixed', 'top-0', 'right-0', 'left-0', 'z-70');

      const inner = bar.firstElementChild as HTMLElement;
      expect(inner.style.backgroundColor).toBe('var(--accent)');
    });

    it('should transition loading → done → idle when pathname changes', () => {
      const { rerender } = render(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      mockPathname = '/ko/garden/pkm';
      rerender(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      const bar = screen.getByTestId('page-transition-progress');
      expect(bar).toHaveAttribute('aria-hidden', 'false');
      expect((bar.firstElementChild as HTMLElement).style.opacity).toBe('1');

      act(() => {
        jest.advanceTimersByTime(600);
      });
      expect(screen.getByTestId('page-transition-progress')).toHaveAttribute('aria-hidden', 'true');
      expect((screen.getByTestId('page-transition-progress').firstElementChild as HTMLElement).style.opacity).toBe('0');

      act(() => {
        jest.advanceTimersByTime(200);
      });
      expect(screen.queryByTestId('page-transition-progress')).not.toBeInTheDocument();
    });

    it('should transition the same way when search params change', () => {
      const { rerender } = render(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      mockSearchParams = new URLSearchParams('tag=react');
      rerender(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      expect(screen.getByTestId('page-transition-progress')).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(800);
      });
      expect(screen.queryByTestId('page-transition-progress')).not.toBeInTheDocument();
    });

    it('should cancel the in-flight cycle and restart when navigation happens during fade', () => {
      const { rerender } = render(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      mockPathname = '/ko/garden/pkm';
      rerender(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      act(() => {
        jest.advanceTimersByTime(700);
      });
      // Now in 'done' phase
      mockPathname = '/ko/garden/pkm/sub';
      rerender(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      const bar = screen.getByTestId('page-transition-progress');
      expect(bar).toHaveAttribute('aria-hidden', 'false');
      expect((bar.firstElementChild as HTMLElement).style.opacity).toBe('1');
    });
  });

  describe('reduced motion', () => {
    it('should skip the loading phase and only show a brief fade', () => {
      mockMatchMedia(true);

      const { rerender } = render(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      mockPathname = '/ko/garden/pkm';
      rerender(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      const bar = screen.getByTestId('page-transition-progress');
      expect(bar).toHaveAttribute('aria-hidden', 'true');
      const inner = bar.firstElementChild as HTMLElement;
      expect(inner.style.transition).toBe('opacity 200ms linear');

      act(() => {
        jest.advanceTimersByTime(200);
      });
      expect(screen.queryByTestId('page-transition-progress')).not.toBeInTheDocument();
    });

    it('should react to a reduced-motion change after mount', () => {
      const { listeners } = mockMatchMedia(false);

      const { rerender } = render(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      emitReducedMotionChange(listeners, true);

      mockPathname = '/ko/garden/pkm';
      rerender(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      expect(screen.getByTestId('page-transition-progress')).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('media query subscription', () => {
    it('should register and remove the change listener with the same handler', () => {
      const { addEventListener, removeEventListener } = mockMatchMedia(false);

      const { unmount } = render(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      expect(addEventListener).toHaveBeenCalledTimes(1);
      expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

      const registeredHandler = addEventListener.mock.calls[0]?.[1];

      unmount();

      expect(removeEventListener).toHaveBeenCalledTimes(1);
      expect(removeEventListener).toHaveBeenCalledWith('change', registeredHandler);
    });
  });

  it('should clean up pending timers on unmount', () => {
    const { rerender, unmount } = render(
      <ProgressProvider>
        <span>x</span>
      </ProgressProvider>
    );

    mockPathname = '/ko/garden/pkm';
    rerender(
      <ProgressProvider>
        <span>x</span>
      </ProgressProvider>
    );

    expect(jest.getTimerCount()).toBeGreaterThan(0);

    unmount();

    expect(jest.getTimerCount()).toBe(0);
  });
});
