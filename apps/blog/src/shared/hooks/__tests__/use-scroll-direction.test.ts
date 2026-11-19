import { act, renderHook } from '@testing-library/react';

import { useScrollDirection } from '../use-scroll-direction';

describe('useScrollDirection', () => {
  let scrollY: number;

  beforeEach(() => {
    scrollY = 0;
    Object.defineProperty(window, 'scrollY', {
      get: () => scrollY,
      configurable: true,
    });
    // requestAnimationFrame을 즉시 실행되도록 모킹
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const simulateScroll = (y: number) => {
    act(() => {
      scrollY = y;
      window.dispatchEvent(new Event('scroll'));
    });
  };

  describe('초기 상태', () => {
    it('초기에는 visible 상태여야 함', () => {
      const { result } = renderHook(() => useScrollDirection());

      expect(result.current.isVisible).toBe(true);
      expect(result.current.isAtTop).toBe(true);
    });

    it('initialVisible=false 옵션이 적용되어야 함', () => {
      const { result } = renderHook(() => useScrollDirection({ initialVisible: false }));

      expect(result.current.isVisible).toBe(false);
    });
  });

  describe('스크롤 동작', () => {
    it('threshold 이하에서는 항상 visible', () => {
      const { result } = renderHook(() => useScrollDirection({ threshold: 50 }));

      simulateScroll(30);

      expect(result.current.isVisible).toBe(true);
      expect(result.current.isAtTop).toBe(true);
    });

    it('아래로 스크롤하면 숨겨짐', () => {
      const { result } = renderHook(() => useScrollDirection({ threshold: 50 }));

      // 먼저 threshold 이상으로 스크롤
      simulateScroll(100);
      // 더 아래로 스크롤
      simulateScroll(200);

      expect(result.current.isVisible).toBe(false);
      expect(result.current.isAtTop).toBe(false);
    });

    it('위로 스크롤하면 다시 나타남', () => {
      const { result } = renderHook(() => useScrollDirection({ threshold: 50 }));

      // 아래로 스크롤하여 숨김 (5px 이상 차이 필요)
      simulateScroll(100);
      simulateScroll(200);
      expect(result.current.isVisible).toBe(false);

      // 위로 스크롤 (5px 이상 차이 필요)
      simulateScroll(180);

      expect(result.current.isVisible).toBe(true);
    });

    it('작은 스크롤 변화(5px 이하)는 무시됨', () => {
      const { result } = renderHook(() => useScrollDirection({ threshold: 50 }));

      simulateScroll(100);
      const initialVisibility = result.current.isVisible;

      // 3px만 이동 (무시되어야 함)
      simulateScroll(103);

      expect(result.current.isVisible).toBe(initialVisibility);
    });

    it('상단으로 돌아오면 isAtTop이 true가 됨', () => {
      const { result } = renderHook(() => useScrollDirection({ threshold: 50 }));

      // 아래로 스크롤 (threshold 초과)
      simulateScroll(100);
      expect(result.current.isAtTop).toBe(false);

      // 상단으로 복귀 (threshold 이하)
      simulateScroll(30);
      expect(result.current.isAtTop).toBe(true);
      expect(result.current.isVisible).toBe(true);
    });
  });

  describe('커스텀 threshold', () => {
    it('threshold 값을 변경할 수 있음', () => {
      const { result } = renderHook(() => useScrollDirection({ threshold: 100 }));

      // 80px 스크롤 - 아직 threshold 이하
      simulateScroll(80);

      expect(result.current.isAtTop).toBe(true);
      expect(result.current.isVisible).toBe(true);
    });
  });

  describe('이벤트 리스너', () => {
    it('언마운트 시 이벤트 리스너가 제거됨', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useScrollDirection());
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });

    it('scroll 이벤트에 passive 옵션이 적용됨', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      renderHook(() => useScrollDirection());

      expect(addEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
      addEventListenerSpy.mockRestore();
    });
  });
});
