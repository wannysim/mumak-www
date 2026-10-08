const mockInit = jest.fn();
const mockCaptureException = jest.fn();

jest.mock('@sentry/nextjs', () => ({
  init: (...args: unknown[]) => mockInit(...args),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

type ErrorTrackingModule = typeof import('../error-tracking');

const DSN = 'https://public@errors.example.com/1';
const originalDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// 모듈 수준 SDK 캐시가 테스트 사이에 새지 않도록 매번 새로 불러온다.
function loadModule(): ErrorTrackingModule {
  let mod: ErrorTrackingModule | undefined;
  jest.isolateModules(() => {
    mod = jest.requireActual<ErrorTrackingModule>('../error-tracking');
  });
  return mod as ErrorTrackingModule;
}

async function flushPromises() {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

describe('error-tracking', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockInit.mockReset();
    mockCaptureException.mockReset();
    process.env.NEXT_PUBLIC_SENTRY_DSN = DSN;
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env.NEXT_PUBLIC_SENTRY_DSN = originalDsn;
  });

  describe('when DSN is not configured', () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    });

    it('never loads or initializes the SDK', async () => {
      const addListenerSpy = jest.spyOn(window, 'addEventListener');
      const { captureException, initClientErrorTracking } = loadModule();

      initClientErrorTracking();
      captureException(new Error('boom'));
      jest.runAllTimers();
      await flushPromises();

      expect(addListenerSpy).not.toHaveBeenCalled();
      expect(mockInit).not.toHaveBeenCalled();
      expect(mockCaptureException).not.toHaveBeenCalled();
      addListenerSpy.mockRestore();
    });
  });

  describe('initClientErrorTracking', () => {
    it('defers SDK init until the browser is idle after load', async () => {
      const { initClientErrorTracking } = loadModule();

      initClientErrorTracking();
      await flushPromises();
      expect(mockInit).not.toHaveBeenCalled();

      // jsdom에는 requestIdleCallback이 없어 setTimeout 폴백 경로를 탄다.
      jest.runAllTimers();
      await flushPromises();

      expect(mockInit).toHaveBeenCalledTimes(1);
      expect(mockInit).toHaveBeenCalledWith(expect.objectContaining({ dsn: DSN }));
    });

    it('waits for the load event when the document is still loading', async () => {
      const readyStateSpy = jest.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
      const { initClientErrorTracking } = loadModule();

      initClientErrorTracking();
      jest.runAllTimers();
      await flushPromises();
      expect(mockInit).not.toHaveBeenCalled();

      window.dispatchEvent(new Event('load'));
      jest.runAllTimers();
      await flushPromises();

      expect(mockInit).toHaveBeenCalledTimes(1);
      readyStateSpy.mockRestore();
    });

    it('uses requestIdleCallback when available', async () => {
      const requestIdleCallback = jest.fn((task: () => void) => {
        task();
        return 1;
      });
      Object.defineProperty(window, 'requestIdleCallback', { value: requestIdleCallback, configurable: true });
      const { initClientErrorTracking } = loadModule();

      initClientErrorTracking();
      await flushPromises();

      expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 5_000 });
      expect(mockInit).toHaveBeenCalledTimes(1);
      Reflect.deleteProperty(window, 'requestIdleCallback');
    });

    it('drops the unused BrowserTracing integration', async () => {
      const { initClientErrorTracking } = loadModule();

      initClientErrorTracking();
      jest.runAllTimers();
      await flushPromises();

      const { integrations } = mockInit.mock.calls[0][0] as {
        integrations: (defaults: { name: string }[]) => { name: string }[];
      };
      expect(integrations([{ name: 'BrowserTracing' }, { name: 'GlobalHandlers' }])).toEqual([
        { name: 'GlobalHandlers' },
      ]);
    });

    it('forwards errors raised before the SDK loaded, then stops buffering', async () => {
      const { initClientErrorTracking } = loadModule();
      const early = new Error('early');
      const rejection = new Error('rejected');
      const removeListenerSpy = jest.spyOn(window, 'removeEventListener');

      initClientErrorTracking();
      window.dispatchEvent(new ErrorEvent('error', { error: early }));
      const rejectionEvent = new Event('unhandledrejection');
      Object.assign(rejectionEvent, { reason: rejection });
      window.dispatchEvent(rejectionEvent);

      jest.runAllTimers();
      await flushPromises();

      expect(mockCaptureException).toHaveBeenNthCalledWith(1, early);
      expect(mockCaptureException).toHaveBeenNthCalledWith(2, rejection);

      // 로드 이후의 전역 에러는 SDK 자체 핸들러 몫이라 버퍼 리스너를 뗀다.
      expect(removeListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
      expect(removeListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
      removeListenerSpy.mockRestore();
    });

    it('caps the number of buffered errors', async () => {
      const { initClientErrorTracking } = loadModule();

      initClientErrorTracking();
      for (let i = 0; i < 15; i += 1) {
        window.dispatchEvent(new ErrorEvent('error', { message: `error ${i}` }));
      }
      jest.runAllTimers();
      await flushPromises();

      expect(mockCaptureException).toHaveBeenCalledTimes(10);
      expect(mockCaptureException).toHaveBeenNthCalledWith(1, 'error 0');
    });
  });

  describe('captureException', () => {
    it('loads the SDK on demand and reports the error', async () => {
      const { captureException } = loadModule();
      const error = new Error('boundary');

      captureException(error);
      await flushPromises();

      expect(mockInit).toHaveBeenCalledTimes(1);
      expect(mockCaptureException).toHaveBeenCalledWith(error);
    });

    it('initializes the SDK only once across calls', async () => {
      const { captureException, initClientErrorTracking } = loadModule();

      initClientErrorTracking();
      captureException(new Error('a'));
      captureException(new Error('b'));
      jest.runAllTimers();
      await flushPromises();

      expect(mockInit).toHaveBeenCalledTimes(1);
    });

    it('swallows SDK failures so reporting never breaks the app', async () => {
      mockCaptureException.mockImplementation(() => {
        throw new Error('sdk down');
      });
      const { captureException } = loadModule();

      expect(() => captureException(new Error('boom'))).not.toThrow();
      await flushPromises();

      expect(mockCaptureException).toHaveBeenCalledTimes(1);
    });
  });
});
