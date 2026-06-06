import { act, renderHook } from '@testing-library/react';

import { useProgressInterpolation } from '../hooks/use-progress-interpolation';

import '@testing-library/jest-dom';

describe('useProgressInterpolation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the server progress as-is when paused', () => {
    const nowSpy = jest.fn(() => 1000);
    const { result } = renderHook(() =>
      useProgressInterpolation({
        trackId: 'a',
        progressMs: 30_000,
        durationMs: 180_000,
        isPlaying: false,
        fetchedAt: 1000,
        now: nowSpy,
      })
    );

    expect(result.current.progressMs).toBe(30_000);

    act(() => {
      jest.advanceTimersByTime(5_000);
    });

    expect(result.current.progressMs).toBe(30_000);
  });

  it('interpolates progress every tick while playing', () => {
    let currentNow = 10_000;
    const { result } = renderHook(() =>
      useProgressInterpolation({
        trackId: 'a',
        progressMs: 5_000,
        durationMs: 60_000,
        isPlaying: true,
        fetchedAt: 10_000,
        now: () => currentNow,
      })
    );

    expect(result.current.progressMs).toBe(5_000);

    act(() => {
      currentNow = 11_000;
      jest.advanceTimersByTime(1_000);
    });
    expect(result.current.progressMs).toBe(6_000);

    act(() => {
      currentNow = 13_500;
      jest.advanceTimersByTime(1_000);
    });
    expect(result.current.progressMs).toBe(8_500);
  });

  it('clamps progress at the track duration', () => {
    let currentNow = 0;
    const { result } = renderHook(() =>
      useProgressInterpolation({
        trackId: 'a',
        progressMs: 9_500,
        durationMs: 10_000,
        isPlaying: true,
        fetchedAt: 0,
        now: () => currentNow,
      })
    );

    act(() => {
      currentNow = 5_000;
      jest.advanceTimersByTime(1_000);
    });

    expect(result.current.progressMs).toBe(10_000);
  });

  it('resets the baseline when the track changes', () => {
    let currentNow = 0;
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useProgressInterpolation>[0]) => useProgressInterpolation(props),
      {
        initialProps: {
          trackId: 'a',
          progressMs: 30_000,
          durationMs: 60_000,
          isPlaying: true,
          fetchedAt: 0,
          now: () => currentNow,
        },
      }
    );

    act(() => {
      currentNow = 4_000;
      jest.advanceTimersByTime(1_000);
    });
    expect(result.current.progressMs).toBe(34_000);

    // 새 트랙으로 전환 — progress 0 부터 다시 시작
    rerender({
      trackId: 'b',
      progressMs: 0,
      durationMs: 120_000,
      isPlaying: true,
      fetchedAt: 5_000,
      now: () => currentNow,
    });

    expect(result.current.progressMs).toBe(0);

    act(() => {
      currentNow = 7_000;
      jest.advanceTimersByTime(1_000);
    });

    expect(result.current.progressMs).toBe(2_000);
  });

  it('returns null when progress data is missing', () => {
    const { result } = renderHook(() =>
      useProgressInterpolation({
        trackId: null,
        progressMs: null,
        durationMs: null,
        isPlaying: false,
        fetchedAt: 0,
      })
    );

    expect(result.current.progressMs).toBeNull();
    expect(result.current.durationMs).toBeNull();
  });

  it('updates the baseline when a new poll arrives (corrects drift)', () => {
    let currentNow = 0;
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useProgressInterpolation>[0]) => useProgressInterpolation(props),
      {
        initialProps: {
          trackId: 'a',
          progressMs: 1_000,
          durationMs: 60_000,
          isPlaying: true,
          fetchedAt: 0,
          now: () => currentNow,
        },
      }
    );

    act(() => {
      currentNow = 4_000;
      jest.advanceTimersByTime(1_000);
    });
    expect(result.current.progressMs).toBe(5_000);

    // 서버가 6초 시점에 progress=10000 으로 응답 (사용자가 스크러빙 등으로 점프)
    rerender({
      trackId: 'a',
      progressMs: 10_000,
      durationMs: 60_000,
      isPlaying: true,
      fetchedAt: 6_000,
      now: () => currentNow,
    });

    expect(result.current.progressMs).toBe(10_000);

    act(() => {
      currentNow = 8_000;
      jest.advanceTimersByTime(1_000);
    });
    expect(result.current.progressMs).toBe(12_000);
  });

  it('ignores small backward jitter from Spotify (within tolerance) to keep UI monotonic', () => {
    let currentNow = 0;
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useProgressInterpolation>[0]) => useProgressInterpolation(props),
      {
        initialProps: {
          trackId: 'a',
          progressMs: 43_000,
          durationMs: 200_000,
          isPlaying: true,
          fetchedAt: 0,
          now: () => currentNow,
        },
      }
    );

    // 1초 후 보간 tick 진행
    act(() => {
      currentNow = 1_000;
      jest.advanceTimersByTime(1_000);
    });
    expect(result.current.progressMs).toBe(44_000);

    // 다음 폴 응답이 약간 뒤처져서 도착 — fetchedAt=2000 이지만 progressMs=43500
    // 예상값(45000)보다 1500ms 작음 → tolerance 안 → baseline 흔들지 않음, UI 도 후진하지 않음
    act(() => {
      currentNow = 2_000;
      rerender({
        trackId: 'a',
        progressMs: 43_500,
        durationMs: 200_000,
        isPlaying: true,
        fetchedAt: 2_000,
        now: () => currentNow,
      });
    });
    // raw progressMs 가 44000 보다 작지만 UI 는 흔들리지 않음
    expect(result.current.progressMs).toBe(44_000);

    // 다음 tick: 기존 baseline (43000, fetchedAt=0) 기반으로 계속 진행 → 단조 증가
    act(() => {
      currentNow = 3_000;
      jest.advanceTimersByTime(1_000);
    });
    expect(result.current.progressMs).toBeGreaterThanOrEqual(44_000);
  });

  it('returns the raw progress value when durationMs is null (no clamp upper bound)', () => {
    let currentNow = 0;
    const { result } = renderHook(() =>
      useProgressInterpolation({
        trackId: 'a',
        progressMs: 1_234,
        durationMs: null,
        isPlaying: true,
        fetchedAt: 0,
        now: () => currentNow,
      })
    );

    expect(result.current.progressMs).toBe(1_234);
    expect(result.current.durationMs).toBeNull();

    act(() => {
      currentNow = 2_000;
      jest.advanceTimersByTime(1_000);
    });

    // duration 이 없으면 상한이 없고 음수만 0으로 클램프
    expect(result.current.progressMs).toBe(3_234);
  });

  it('treats a non-positive durationMs as an absent upper bound', () => {
    const { result } = renderHook(() =>
      useProgressInterpolation({
        trackId: 'a',
        progressMs: 500,
        durationMs: 0,
        isPlaying: false,
        fetchedAt: 0,
        now: () => 0,
      })
    );

    // durationMs <= 0 인 경우 max(0, value) 만 적용
    expect(result.current.progressMs).toBe(500);
  });

  it('clamps negative progress to zero when paused', () => {
    const { result } = renderHook(() =>
      useProgressInterpolation({
        trackId: 'a',
        // 비정상적으로 음수인 progressMs (방어 가드 확인)
        progressMs: -100,
        durationMs: 60_000,
        isPlaying: false,
        fetchedAt: 0,
        now: () => 0,
      })
    );

    expect(result.current.progressMs).toBe(0);
  });

  it('clears the interval on unmount', () => {
    const clearIntervalSpy = jest.spyOn(globalThis, 'clearInterval');

    const { unmount } = renderHook(() =>
      useProgressInterpolation({
        trackId: 'a',
        progressMs: 1_000,
        durationMs: 60_000,
        isPlaying: true,
        fetchedAt: 0,
        now: () => 0,
      })
    );

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it('does not start an interval when paused (no interval to clear)', () => {
    const setIntervalSpy = jest.spyOn(globalThis, 'setInterval');

    renderHook(() =>
      useProgressInterpolation({
        trackId: 'a',
        progressMs: 1_000,
        durationMs: 60_000,
        isPlaying: false,
        fetchedAt: 0,
        now: () => 0,
      })
    );

    // 일시정지 상태에서는 useEffect 가 일찍 return — setInterval 호출 없음
    expect(setIntervalSpy).not.toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });

  it('resets to null when progress data disappears after being set', () => {
    let currentNow = 0;
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useProgressInterpolation>[0]) => useProgressInterpolation(props),
      {
        initialProps: {
          trackId: 'a' as string | null,
          progressMs: 5_000 as number | null,
          durationMs: 60_000 as number | null,
          isPlaying: true,
          fetchedAt: 0,
          now: () => currentNow,
        },
      }
    );

    expect(result.current.progressMs).toBe(5_000);

    // 다음 폴링에서 progress 데이터가 사라짐 (예: 재생 종료)
    rerender({
      trackId: null,
      progressMs: null,
      durationMs: null,
      isPlaying: false,
      fetchedAt: 1_000,
      now: () => currentNow,
    });

    expect(result.current.progressMs).toBeNull();
    expect(result.current.durationMs).toBeNull();
  });

  it('stops interpolating when isPlaying flips to false', () => {
    let currentNow = 0;
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useProgressInterpolation>[0]) => useProgressInterpolation(props),
      {
        initialProps: {
          trackId: 'a',
          progressMs: 1_000,
          durationMs: 60_000,
          isPlaying: true,
          fetchedAt: 0,
          now: () => currentNow,
        },
      }
    );

    act(() => {
      currentNow = 2_000;
      jest.advanceTimersByTime(1_000);
    });
    expect(result.current.progressMs).toBe(3_000);

    rerender({
      trackId: 'a',
      progressMs: 3_000,
      durationMs: 60_000,
      isPlaying: false,
      fetchedAt: 3_000,
      now: () => currentNow,
    });

    act(() => {
      currentNow = 10_000;
      jest.advanceTimersByTime(5_000);
    });

    expect(result.current.progressMs).toBe(3_000);
  });
});
