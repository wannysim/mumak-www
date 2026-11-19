import { createElement } from 'react';

import '@testing-library/jest-dom/vitest';

// Mock next/server
vi.mock('next/server', async importOriginal => {
  const actualModule = await importOriginal<typeof import('next/server')>();
  return {
    ...actualModule,
    connection: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/';
  },
  // 실제 구현은 SSR 스트림에서만 콜백을 실행하므로 클라이언트(jsdom)에서는 no-op
  useServerInsertedHTML: vi.fn(),
}));

// Mock Next.js image component
vi.mock('next/image', () => ({
  default: (props: React.ComponentPropsWithoutRef<'img'>) =>
    createElement('div', { ...props, 'data-testid': 'next-image' }),
}));

// Mock next-intl/server
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(({ locale, namespace }: { locale: string; namespace?: string }) => {
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
  getLocale: vi.fn(() => Promise.resolve('ko')),
  setRequestLocale: vi.fn(),
}));

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
);

vi.stubGlobal(
  'IntersectionObserver',
  class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
);

// jsdom does not implement HTMLCanvasElement.getContext, so any code that
// probes for WebGL/2D context (graph-canvas WebGL detection, etc.) leaks a
// console.error from jsdom's VirtualConsole. Returning null lets the
// production fallback path execute cleanly. Some test suites (RSS feed
// generation, etc.) run in node — guard so we don't ReferenceError there.
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
}

// jsdom does not implement Element.scrollIntoView either; cmdk's CommandItem
// uses it on the highlighted option to keep it visible.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}
