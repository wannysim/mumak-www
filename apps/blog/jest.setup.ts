import '@testing-library/jest-dom';

// Mock next/server
jest.mock('next/server', () => {
  const actualModule = jest.requireActual('next/server');
  return {
    ...actualModule,
    connection: jest.fn().mockResolvedValue(undefined),
  };
});

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/';
  },
}));

// Mock Next.js image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ComponentPropsWithoutRef<'img'>) => {
    // Return a simple div instead of JSX
    return {
      type: 'div',
      props: { ...props, 'data-testid': 'next-image' },
    };
  },
}));

// Mock next-intl/server
jest.mock('next-intl/server', () => ({
  getTranslations: jest.fn(({ locale, namespace }: { locale: string; namespace?: string }) => {
    const messages: Record<string, Record<string, Record<string, string> | string>> = {
      ko: {
        feed: {
          title: 'Wan Sim - 블로그',
          description: '생각과 기록을 담는 공간',
        },
      },
      en: {
        feed: {
          title: 'Wan Sim',
          description: 'A space for thoughts and records',
        },
      },
    };

    return Promise.resolve((key: string): string => {
      const localeMessages = messages[locale] || messages.en;
      if (!localeMessages) return key;

      const namespaceMessages = namespace
        ? (localeMessages[namespace] as Record<string, string> | undefined)
        : undefined;

      if (namespaceMessages && typeof namespaceMessages === 'object') {
        return (namespaceMessages[key] as string) || key;
      }

      return key;
    });
  }),
  getLocale: jest.fn(() => Promise.resolve('ko')),
  setRequestLocale: jest.fn(),
}));

// Global test utilities
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// jsdom does not implement HTMLCanvasElement.getContext, so any code that
// probes for WebGL/2D context (graph-canvas WebGL detection, etc.) leaks a
// console.error from jsdom's VirtualConsole. Returning null lets the
// production fallback path execute cleanly. Some test suites (RSS feed
// generation, etc.) run in node — guard so we don't ReferenceError there.
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = jest.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
}

// jsdom does not implement Element.scrollIntoView either; cmdk's CommandItem
// uses it on the highlighted option to keep it visible.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = jest.fn();
}
