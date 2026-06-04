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

function setLocation(href: string) {
  const url = new URL(href);
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

async function clickAndSettle(anchor: HTMLAnchorElement, init: MouseEventInit = {}) {
  await act(async () => {
    dispatchClick(anchor, init);
    await Promise.resolve();
    await Promise.resolve();
  });
}

function makeAnchor(attrs: Partial<HTMLAnchorElement> & Record<string, string | boolean | undefined>) {
  const anchor = document.createElement('a');
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined) continue;
    if (typeof value === 'boolean') {
      if (value) anchor.setAttribute(key, '');
      continue;
    }
    if (key === 'href') {
      anchor.setAttribute('href', value as string);
      continue;
    }
    anchor.setAttribute(key, value as string);
  }
  document.body.appendChild(anchor);
  return anchor;
}

function dispatchClick(anchor: HTMLAnchorElement, init: MouseEventInit = {}) {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...init,
  });
  anchor.dispatchEvent(event);
  return event;
}

describe('ProgressProvider', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
    mockMatchMedia(false);
    mockPathname = '/ko/garden';
    mockSearchParams = new URLSearchParams();
    setLocation('http://localhost/ko/garden');
    document.body.innerHTML = '';
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

  it('should never wrap history APIs (no popstate/pushState listeners on window)', () => {
    const addWindowListenerSpy = jest.spyOn(window, 'addEventListener');

    render(
      <ProgressProvider>
        <span>x</span>
      </ProgressProvider>
    );

    const historyHits = addWindowListenerSpy.mock.calls.filter(([type]) =>
      ['popstate', 'pushstate', 'replacestate'].includes(String(type).toLowerCase())
    );
    expect(historyHits).toHaveLength(0);

    addWindowListenerSpy.mockRestore();
  });

  describe('click observer', () => {
    it('should attach a passive capture-phase click listener on document', () => {
      const addSpy = jest.spyOn(document, 'addEventListener');

      render(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      const clickCalls = addSpy.mock.calls.filter(([type]) => type === 'click');
      expect(clickCalls).toHaveLength(1);
      const [, , options] = clickCalls[0]!;
      expect(options).toMatchObject({ capture: true, passive: true });

      addSpy.mockRestore();
    });

    it('should remove the click listener on unmount with matching options', () => {
      const addSpy = jest.spyOn(document, 'addEventListener');
      const removeSpy = jest.spyOn(document, 'removeEventListener');

      const { unmount } = render(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      const handler = addSpy.mock.calls.find(([type]) => type === 'click')?.[1];
      unmount();

      const removeCall = removeSpy.mock.calls.find(([type]) => type === 'click');
      expect(removeCall?.[1]).toBe(handler);

      addSpy.mockRestore();
      removeSpy.mockRestore();
    });

    it('should NOT call setState synchronously inside the click handler (webkit-safe)', () => {
      render(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      const anchor = makeAnchor({ href: 'http://localhost/ko/about' });
      dispatchClick(anchor);

      // Synchronously after the click: no bar yet — state update is deferred.
      expect(screen.queryByTestId('page-transition-progress')).not.toBeInTheDocument();
    });

    it('should show the bar after the microtask, in loading phase, for internal anchor clicks', async () => {
      render(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      const anchor = makeAnchor({ href: 'http://localhost/ko/about' });
      await clickAndSettle(anchor);

      const bar = screen.getByTestId('page-transition-progress');
      expect(bar).toHaveAttribute('aria-hidden', 'false');
      expect(bar.tagName).toBe('PROGRESS');
    });

    it('should NOT preventDefault on the observed click (real navigation must proceed)', () => {
      render(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      const anchor = makeAnchor({ href: 'http://localhost/ko/about' });
      const event = dispatchClick(anchor);
      expect(event.defaultPrevented).toBe(false);
    });

    it.each<[string, MouseEventInit | Partial<HTMLAnchorElement>, 'modifier' | 'anchor']>([
      ['cmd-click', { metaKey: true }, 'modifier'],
      ['ctrl-click', { ctrlKey: true }, 'modifier'],
      ['shift-click', { shiftKey: true }, 'modifier'],
      ['middle-click', { button: 1 }, 'modifier'],
    ])('should ignore %s (user wants new tab / non-navigating)', async (_label, init) => {
      render(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      const anchor = makeAnchor({ href: 'http://localhost/ko/about' });
      await clickAndSettle(anchor, init as MouseEventInit);

      expect(screen.queryByTestId('page-transition-progress')).not.toBeInTheDocument();
    });

    it('should ignore clicks on external links', async () => {
      render(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      const anchor = makeAnchor({ href: 'https://example.com/somewhere' });
      await clickAndSettle(anchor);

      expect(screen.queryByTestId('page-transition-progress')).not.toBeInTheDocument();
    });

    it('should ignore clicks with target="_blank"', async () => {
      render(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      const anchor = makeAnchor({ href: 'http://localhost/ko/about', target: '_blank' });
      await clickAndSettle(anchor);

      expect(screen.queryByTestId('page-transition-progress')).not.toBeInTheDocument();
    });

    it('should ignore download links', async () => {
      render(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      const anchor = makeAnchor({ href: 'http://localhost/file.pdf', download: 'file.pdf' });
      await clickAndSettle(anchor);

      expect(screen.queryByTestId('page-transition-progress')).not.toBeInTheDocument();
    });

    it('should ignore hash-only links (same pathname + same search)', async () => {
      render(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      const anchor = makeAnchor({ href: 'http://localhost/ko/garden#section' });
      await clickAndSettle(anchor);

      expect(screen.queryByTestId('page-transition-progress')).not.toBeInTheDocument();
    });

    it('should not attach a click listener when reduced motion is preferred', () => {
      mockMatchMedia(true);
      const addSpy = jest.spyOn(document, 'addEventListener');

      render(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      const clickCalls = addSpy.mock.calls.filter(([type]) => type === 'click');
      expect(clickCalls).toHaveLength(0);

      addSpy.mockRestore();
    });
  });

  describe('navigation completion', () => {
    it('should transition loading → done → idle when pathname change follows a click', async () => {
      const { rerender } = render(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      const anchor = makeAnchor({ href: 'http://localhost/ko/about' });
      await clickAndSettle(anchor);

      expect(screen.getByTestId('page-transition-progress')).toHaveAttribute('aria-hidden', 'false');

      mockPathname = '/ko/about';
      rerender(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      expect(screen.getByTestId('page-transition-progress')).toHaveAttribute('aria-hidden', 'true');

      act(() => {
        jest.advanceTimersByTime(200);
      });
      expect(screen.queryByTestId('page-transition-progress')).not.toBeInTheDocument();
    });

    it('should flash briefly for programmatic navigation without a click', () => {
      const { rerender } = render(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      mockPathname = '/ko/about';
      rerender(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      // Goes through loading → done → idle in a compressed flash.
      expect(screen.getByTestId('page-transition-progress')).toHaveAttribute('aria-hidden', 'false');

      act(() => {
        jest.advanceTimersByTime(80);
      });
      expect(screen.getByTestId('page-transition-progress')).toHaveAttribute('aria-hidden', 'true');

      act(() => {
        jest.advanceTimersByTime(200);
      });
      expect(screen.queryByTestId('page-transition-progress')).not.toBeInTheDocument();
    });

    it('should complete safely if navigation never lands (safety timeout)', async () => {
      render(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      const anchor = makeAnchor({ href: 'http://localhost/ko/about' });
      await clickAndSettle(anchor);

      expect(screen.getByTestId('page-transition-progress')).toHaveAttribute('aria-hidden', 'false');

      act(() => {
        jest.advanceTimersByTime(8000);
      });
      expect(screen.getByTestId('page-transition-progress')).toHaveAttribute('aria-hidden', 'true');

      act(() => {
        jest.advanceTimersByTime(200);
      });
      expect(screen.queryByTestId('page-transition-progress')).not.toBeInTheDocument();
    });
  });

  describe('reduced motion', () => {
    it('should skip the loading phase and only show a brief fade on navigation', () => {
      mockMatchMedia(true);

      const { rerender } = render(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      mockPathname = '/ko/about';
      rerender(
        <ProgressProvider>
          <span>x</span>
        </ProgressProvider>
      );

      const bar = screen.getByTestId('page-transition-progress');
      expect(bar).toHaveAttribute('aria-hidden', 'true');
      expect(bar.style.transition).toBe('opacity 200ms linear');

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

      mockPathname = '/ko/about';
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

    mockPathname = '/ko/about';
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
