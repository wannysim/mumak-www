import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerServiceWorker } from '../register-sw';

const register = vi.fn();

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
    register.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'serviceWorker', { value: { register }, configurable: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

  it('registers the worker only once the page has loaded', () => {
    vi.stubEnv('PROD', true);
    const load = captureLoadListener();

    registerServiceWorker();
    expect(register).not.toHaveBeenCalled();

    load.fire();
    expect(register).toHaveBeenCalledWith('/sw.js');
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
