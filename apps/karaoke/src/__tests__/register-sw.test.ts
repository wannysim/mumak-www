import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerServiceWorker } from '../register-sw';

const register = vi.fn();
const postMessage = vi.fn();
const getEntriesByType = vi.fn();

/** load 리스너가 테스트 사이에 누적되지 않도록 등록된 것만 잡아서 직접 호출한다. */
function captureLoadListener() {
  let listener: EventListener | undefined;
  const spy = vi.spyOn(window, 'addEventListener').mockImplementation((type, handler) => {
    if (type === 'load') listener = handler as EventListener;
  });
  return {
    spy,
    fire: () => listener?.(new Event('load')),
    get registered() {
      return listener !== undefined;
    },
  };
}

describe('registerServiceWorker', () => {
  beforeEach(() => {
    postMessage.mockReset();
    getEntriesByType.mockReset().mockReturnValue([]);
    vi.stubGlobal('performance', { getEntriesByType });
    const active = { postMessage };
    register.mockReset().mockResolvedValue({ installing: null, waiting: null, active });
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register,
        ready: Promise.resolve({ active }),
      },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('does not register in development', () => {
    vi.stubEnv('PROD', false);
    const load = captureLoadListener();

    registerServiceWorker();

    expect(load.registered).toBe(false);
    expect(register).not.toHaveBeenCalled();
  });

  it('registers the worker only once the page has loaded', async () => {
    vi.stubEnv('PROD', true);
    const load = captureLoadListener();

    registerServiceWorker();
    expect(register).not.toHaveBeenCalled();

    load.fire();
    expect(register).toHaveBeenCalledWith('/sw.js');
    await vi.waitFor(() => expect(getEntriesByType).toHaveBeenCalledWith('resource'));
  });

  it('asks the active worker to cache only loaded same-origin assets', async () => {
    vi.stubEnv('PROD', true);
    const assetUrl = new URL('/assets/index.js', window.location.href).href;
    const fontUrl = new URL('/assets/noto-serif-jp.woff2', window.location.href).href;
    getEntriesByType.mockReturnValue([
      { name: assetUrl },
      { name: fontUrl },
      { name: 'https://www.youtube.com/iframe_api' },
    ]);
    const load = captureLoadListener();

    registerServiceWorker();
    load.fire();

    await vi.waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        {
          type: 'CACHE_VISITED_ASSETS',
          urls: [assetUrl, fontUrl],
        },
        []
      )
    );
  });

  it('hands visited assets to every worker involved in an upgrade', async () => {
    vi.stubEnv('PROD', true);
    const assetUrl = new URL('/assets/index.js', window.location.href).href;
    getEntriesByType.mockReturnValue([{ name: assetUrl }]);
    const installing = { postMessage: vi.fn() };
    const waiting = { postMessage: vi.fn() };
    const active = { postMessage: vi.fn() };
    const previouslyActive = { postMessage: vi.fn() };
    register.mockResolvedValue({ installing, waiting, active });
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register, ready: Promise.resolve({ active: previouslyActive }) },
      configurable: true,
    });
    const load = captureLoadListener();

    registerServiceWorker();
    load.fire();

    for (const worker of [installing, waiting, active, previouslyActive]) {
      await vi.waitFor(() =>
        expect(worker.postMessage).toHaveBeenCalledWith({ type: 'CACHE_VISITED_ASSETS', urls: [assetUrl] }, [])
      );
    }
  });

  it('does nothing when the browser has no service worker support', () => {
    vi.stubEnv('PROD', true);
    Reflect.deleteProperty(navigator, 'serviceWorker');
    const load = captureLoadListener();

    expect(() => registerServiceWorker()).not.toThrow();
    expect(load.registered).toBe(false);
  });

  it('swallows registration failures so the app still runs', async () => {
    vi.stubEnv('PROD', true);
    register.mockRejectedValue(new Error('insecure origin'));
    const load = captureLoadListener();

    registerServiceWorker();
    load.fire();

    // 등록 실패는 오프라인 지원만 없는 것이라 rejection이 새어 나가면 안 된다.
    await expect(register.mock.results[0]?.value).rejects.toThrow('insecure origin');
    expect(register).toHaveBeenCalledTimes(1);
  });
});
