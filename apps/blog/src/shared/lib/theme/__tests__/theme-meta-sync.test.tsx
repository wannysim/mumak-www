import { render } from '@testing-library/react';
import { useServerInsertedHTML } from 'next/navigation';
import { isValidElement } from 'react';

import { themeColors } from '../theme-config';
import { ThemeMetaSyncScript, themeMetaSync, themeMetaSyncInlineScript } from '../theme-meta-sync';

import '@testing-library/jest-dom';

const mockUseServerInsertedHTML = useServerInsertedHTML as jest.Mock;

describe('themeMetaSyncInlineScript', () => {
  it('should include theme colors in the script', () => {
    expect(themeMetaSyncInlineScript).toContain(themeColors.light);
    expect(themeMetaSyncInlineScript).toContain(themeColors.dark);
  });

  it('should include theme-color meta tag selector in the script', () => {
    expect(themeMetaSyncInlineScript).toContain('meta[name="theme-color"]');
  });

  it('should include dark class detection logic', () => {
    expect(themeMetaSyncInlineScript).toContain('classList.contains');
    expect(themeMetaSyncInlineScript).toContain('dark');
  });

  it('should use setAttribute to update meta tag content (Safari iOS compatibility)', () => {
    // Safari iOS 호환성을 위해 메타 태그를 삭제/생성하지 않고 setAttribute 사용
    expect(themeMetaSyncInlineScript).toContain('setAttribute');
    expect(themeMetaSyncInlineScript).toContain('content');
  });

  it('should use MutationObserver to watch for class changes', () => {
    expect(themeMetaSyncInlineScript).toContain('MutationObserver');
    expect(themeMetaSyncInlineScript).toContain('observe');
  });

  it('should guard against duplicate execution within the same document', () => {
    expect(themeMetaSyncInlineScript).toContain('window.__themeMetaSynced');
  });
});

describe('ThemeMetaSyncScript', () => {
  afterEach(() => {
    // 전역 mock(no-op jest.fn)으로 복원
    mockUseServerInsertedHTML.mockReset();
  });

  it('should insert the inline script element on the first SSR flush only', () => {
    // useServerInsertedHTML 콜백은 스트리밍 flush마다 재호출될 수 있다 — SSR 환경을 흉내내 두 번 호출
    const flushedNodes: unknown[] = [];
    mockUseServerInsertedHTML.mockImplementation((callback: () => unknown) => {
      flushedNodes.push(callback());
      flushedNodes.push(callback());
    });

    render(<ThemeMetaSyncScript />);

    const [firstFlush, secondFlush] = flushedNodes;
    if (!isValidElement<{ dangerouslySetInnerHTML: { __html: string } }>(firstFlush)) {
      throw new Error('first SSR flush did not return a React element');
    }
    expect(firstFlush.type).toBe('script');
    expect(firstFlush.props.dangerouslySetInnerHTML.__html).toBe(themeMetaSyncInlineScript);
    // 두 번째 flush부터는 중복 삽입을 막기 위해 null
    expect(secondFlush).toBeNull();
  });

  it('should not render a script tag on client render (React 19 warning regression)', () => {
    // locale 전환 등 클라이언트 내비게이션에서 script 노드를 만들면
    // "Encountered a script tag while rendering React component" 경고가 발생한다.
    // 인라인 스크립트는 useServerInsertedHTML로 초기 SSR 스트림에만 삽입된다.
    const { container } = render(<ThemeMetaSyncScript />);

    expect(container.querySelector('script')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
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
