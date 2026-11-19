const mockInit = vi.fn();
const mockCaptureException = vi.fn();

vi.mock('@sentry/nextjs', () => ({
  init: (...args: unknown[]) => mockInit(...args),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

const DSN = 'https://public@errors.example.com/1';

// 모듈 수준 SDK 캐시가 테스트 사이에 새지 않도록 매번 새로 불러온다.
async function loadModule() {
  vi.resetModules();
  return import('../error-tracking');
}

describe('error-tracking', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockInit.mockReset();
    mockCaptureException.mockReset();
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', DSN);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  describe('when DSN is not configured', () => {
    beforeEach(() => {
      vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', undefined);
    });

    it('never loads or initializes the SDK', async () => {
      const addListenerSpy = vi.spyOn(window, 'addEventListener');
      const { captureException, initClientErrorTracking } = await loadModule();

      initClientErrorTracking();
      captureException(new Error('boom'));
      vi.runAllTimers();
      await vi.dynamicImportSettled();

      expect(addListenerSpy).not.toHaveBeenCalled();
      expect(mockInit).not.toHaveBeenCalled();
      expect(mockCaptureException).not.toHaveBeenCalled();
      addListenerSpy.mockRestore();
    });
  });

  describe('initClientErrorTracking', () => {
    it('defers SDK init until the browser is idle after load', async () => {
      const { initClientErrorTracking } = await loadModule();

      initClientErrorTracking();
      await vi.dynamicImportSettled();
      expect(mockInit).not.toHaveBeenCalled();

      // jsdom에는 requestIdleCallback이 없어 setTimeout 폴백 경로를 탄다.
      vi.runAllTimers();
      await vi.dynamicImportSettled();

      expect(mockInit).toHaveBeenCalledTimes(1);
      expect(mockInit).toHaveBeenCalledWith(expect.objectContaining({ dsn: DSN }));
    });

    it('waits for the load event when the document is still loading', async () => {
      const readyStateSpy = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
      const { initClientErrorTracking } = await loadModule();

      initClientErrorTracking();
      vi.runAllTimers();
      await vi.dynamicImportSettled();
      expect(mockInit).not.toHaveBeenCalled();

      window.dispatchEvent(new Event('load'));
      vi.runAllTimers();
      await vi.dynamicImportSettled();

      expect(mockInit).toHaveBeenCalledTimes(1);
      readyStateSpy.mockRestore();
    });

    it('uses requestIdleCallback when available', async () => {
      const requestIdleCallback = vi.fn((task: () => void) => {
        task();
        return 1;
      });
      Object.defineProperty(window, 'requestIdleCallback', { value: requestIdleCallback, configurable: true });
      const { initClientErrorTracking } = await loadModule();

      initClientErrorTracking();
      await vi.dynamicImportSettled();

      expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 5_000 });
      expect(mockInit).toHaveBeenCalledTimes(1);
      Reflect.deleteProperty(window, 'requestIdleCallback');
    });

    it('drops the unused BrowserTracing integration', async () => {
      const { initClientErrorTracking } = await loadModule();

      initClientErrorTracking();
      vi.runAllTimers();
      await vi.dynamicImportSettled();

      const options = mockInit.mock.calls[0]?.[0] as
        | { integrations: (defaults: { name: string }[]) => { name: string }[] }
        | undefined;
      expect(options?.integrations([{ name: 'BrowserTracing' }, { name: 'GlobalHandlers' }])).toEqual([
        { name: 'GlobalHandlers' },
      ]);
    });

    it('forwards errors raised before the SDK loaded, then stops buffering', async () => {
      const { initClientErrorTracking } = await loadModule();
      const early = new Error('early');
      const rejection = new Error('rejected');
      const removeListenerSpy = vi.spyOn(window, 'removeEventListener');

      initClientErrorTracking();
      window.dispatchEvent(new ErrorEvent('error', { error: early }));
      const rejectionEvent = new Event('unhandledrejection');
      Object.assign(rejectionEvent, { reason: rejection });
      window.dispatchEvent(rejectionEvent);

      vi.runAllTimers();
      await vi.dynamicImportSettled();

      expect(mockCaptureException).toHaveBeenNthCalledWith(1, early);
      expect(mockCaptureException).toHaveBeenNthCalledWith(2, rejection);

      // 로드 이후의 전역 에러는 SDK 자체 핸들러 몫이라 버퍼 리스너를 뗀다.
      expect(removeListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
      expect(removeListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
      removeListenerSpy.mockRestore();
    });

    it('caps the number of buffered errors', async () => {
      const { initClientErrorTracking } = await loadModule();

      initClientErrorTracking();
      for (let i = 0; i < 15; i += 1) {
        window.dispatchEvent(new ErrorEvent('error', { message: `error ${i}` }));
      }
      vi.runAllTimers();
      await vi.dynamicImportSettled();

      expect(mockCaptureException).toHaveBeenCalledTimes(10);
      expect(mockCaptureException).toHaveBeenNthCalledWith(1, 'error 0');
    });
  });

  describe('captureException', () => {
    it('loads the SDK on demand and reports the error', async () => {
      const { captureException } = await loadModule();
      const error = new Error('boundary');

      captureException(error);
      await vi.dynamicImportSettled();

      expect(mockInit).toHaveBeenCalledTimes(1);
      expect(mockCaptureException).toHaveBeenCalledWith(error);
    });

    it('initializes the SDK only once across calls', async () => {
      const { captureException, initClientErrorTracking } = await loadModule();

      initClientErrorTracking();
      captureException(new Error('a'));
      captureException(new Error('b'));
      vi.runAllTimers();
      await vi.dynamicImportSettled();

      expect(mockInit).toHaveBeenCalledTimes(1);
    });

    it('swallows SDK failures so reporting never breaks the app', async () => {
      mockCaptureException.mockImplementation(() => {
        throw new Error('sdk down');
      });
      const { captureException } = await loadModule();

      expect(() => captureException(new Error('boom'))).not.toThrow();
      await vi.dynamicImportSettled();

      expect(mockCaptureException).toHaveBeenCalledTimes(1);
    });
  });
});
