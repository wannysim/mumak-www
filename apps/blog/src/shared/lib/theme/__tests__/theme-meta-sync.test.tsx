import '@testing-library/jest-dom';
import { render } from '@testing-library/react';

import { themeColors } from '../theme-config';
import { ThemeMetaSyncScript, themeMetaSync } from '../theme-meta-sync';

describe('ThemeMetaSyncScript', () => {
  it('should render a script tag', () => {
    const { container } = render(<ThemeMetaSyncScript />);

    const script = container.querySelector('script');
    expect(script).toBeInTheDocument();
  });

  it('should include theme colors in the script', () => {
    const { container } = render(<ThemeMetaSyncScript />);

    const script = container.querySelector('script');
    const scriptContent = script?.innerHTML || '';

    expect(scriptContent).toContain(themeColors.light);
    expect(scriptContent).toContain(themeColors.dark);
  });

  it('should include theme-color meta tag selector in the script', () => {
    const { container } = render(<ThemeMetaSyncScript />);

    const script = container.querySelector('script');
    const scriptContent = script?.innerHTML || '';

    expect(scriptContent).toContain('meta[name="theme-color"]');
  });

  it('should include dark class detection logic', () => {
    const { container } = render(<ThemeMetaSyncScript />);

    const script = container.querySelector('script');
    const scriptContent = script?.innerHTML || '';

    expect(scriptContent).toContain('classList.contains');
    expect(scriptContent).toContain('dark');
  });

  it('should use setAttribute to update meta tag content (Safari iOS compatibility)', () => {
    const { container } = render(<ThemeMetaSyncScript />);

    const script = container.querySelector('script');
    const scriptContent = script?.innerHTML || '';

    // Safari iOS 호환성을 위해 메타 태그를 삭제/생성하지 않고 setAttribute 사용
    expect(scriptContent).toContain('setAttribute');
    expect(scriptContent).toContain('content');
  });

  it('should use MutationObserver to watch for class changes', () => {
    const { container } = render(<ThemeMetaSyncScript />);

    const script = container.querySelector('script');
    const scriptContent = script?.innerHTML || '';

    expect(scriptContent).toContain('MutationObserver');
    expect(scriptContent).toContain('observe');
  });
});

describe('themeMetaSync', () => {
  const colors = { light: '#ffffff', dark: '#000000' };
  let metaTag: HTMLMetaElement;
  let observers: MutationObserver[] = [];
  const originalMutationObserver = global.MutationObserver;

  beforeEach(() => {
    document.head.innerHTML = '';
    document.documentElement.classList.remove('dark');

    metaTag = document.createElement('meta');
    metaTag.setAttribute('name', 'theme-color');
    metaTag.setAttribute('content', '#initial');
    document.head.appendChild(metaTag);

    observers = [];
    global.MutationObserver = class MockObserver {
      callback: MutationCallback;
      constructor(callback: MutationCallback) {
        this.callback = callback;
        observers.push(this as unknown as MutationObserver);
      }
      observe = jest.fn();
      disconnect = jest.fn();
      takeRecords = jest.fn(() => []);
    } as unknown as typeof MutationObserver;
  });

  afterEach(() => {
    global.MutationObserver = originalMutationObserver;
    document.head.innerHTML = '';
    document.documentElement.classList.remove('dark');
  });

  it('updates meta tag with light color when html lacks dark class', () => {
    themeMetaSync(colors);

    expect(metaTag.getAttribute('content')).toBe('#ffffff');
  });

  it('updates meta tag with dark color when html has dark class', () => {
    document.documentElement.classList.add('dark');

    themeMetaSync(colors);

    expect(metaTag.getAttribute('content')).toBe('#000000');
  });

  it('does nothing if no theme-color meta tag exists', () => {
    document.head.innerHTML = '';

    expect(() => themeMetaSync(colors)).not.toThrow();
  });

  it('updates all theme-color meta tags', () => {
    const second = document.createElement('meta');
    second.setAttribute('name', 'theme-color');
    second.setAttribute('content', '#stale');
    document.head.appendChild(second);

    themeMetaSync(colors);

    document.querySelectorAll('meta[name="theme-color"]').forEach(tag => {
      expect(tag.getAttribute('content')).toBe('#ffffff');
    });
  });

  it('skips setAttribute when content already matches expected value', () => {
    metaTag.setAttribute('content', '#ffffff');
    const setAttrSpy = jest.spyOn(metaTag, 'setAttribute');

    themeMetaSync(colors);

    expect(setAttrSpy).not.toHaveBeenCalled();
    setAttrSpy.mockRestore();
  });

  it('registers MutationObservers for documentElement class and head subtree', () => {
    themeMetaSync(colors);

    expect(observers).toHaveLength(2);
    expect(observers[0]?.observe).toHaveBeenCalledWith(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    expect(observers[1]?.observe).toHaveBeenCalledWith(document.head, {
      childList: true,
      subtree: true,
    });
  });

  it('re-runs sync when MutationObserver callback fires after class change', () => {
    themeMetaSync(colors);
    expect(metaTag.getAttribute('content')).toBe('#ffffff');

    document.documentElement.classList.add('dark');
    const themeObserver = observers[0] as unknown as { callback: MutationCallback } | undefined;
    themeObserver?.callback([], themeObserver as unknown as MutationObserver);

    expect(metaTag.getAttribute('content')).toBe('#000000');
  });
});
