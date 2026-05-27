import { act, renderHook } from '@testing-library/react';
import useSWR from 'swr';

import type { NowPlaying } from '@/src/entities/spotify';

import '@testing-library/jest-dom';

// Mock fetch for fetcher tests
const mockFetch = jest.fn();
global.fetch = mockFetch;

// SWR 응답 데이터를 제어하기 위한 변수
let swrReturnValue: {
  data: { data: NowPlaying | null; timestamp: number } | undefined;
  error: Error | undefined;
  isLoading: boolean;
  mutate: jest.Mock;
};

// Mock SWR
const mockMutate = jest.fn();
jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn((key, _fetcher, options) => {
    // 외부에서 제어 가능한 값이 있으면 사용
    if (swrReturnValue) {
      return swrReturnValue;
    }
    // Return fallback data if provided
    if (options?.fallbackData) {
      return {
        data: options.fallbackData,
        error: undefined,
        isLoading: false,
        mutate: mockMutate,
      };
    }
    return {
      data: undefined,
      error: undefined,
      isLoading: Boolean(key),
      mutate: mockMutate,
    };
  }),
}));

const mockUseSWR = jest.mocked(useSWR);

const mockSongData: NowPlaying = {
  isPlaying: true,
  title: 'Test Song',
  artist: 'Test Artist',
  album: 'Test Album',
  albumImageUrl: 'https://i.scdn.co/test.jpg',
  songUrl: 'https://open.spotify.com/track/test',
  isExplicit: false,
  progressMs: 1000,
  durationMs: 60000,
  device: { name: 'MacBook Pro', type: 'Computer' },
};

describe('useSpotifyPolling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset visibility state
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
    });
    // Reset SWR return value
    swrReturnValue = undefined as unknown as typeof swrReturnValue;
    // Reset fetch mock
    mockFetch.mockReset();
  });

  it('should return initial data when provided', async () => {
    const { useSpotifyPolling } = await import('../hooks/use-spotify-polling');

    const { result } = renderHook(() =>
      useSpotifyPolling({
        initialData: mockSongData,
      })
    );

    expect(result.current.data).toEqual(mockSongData);
    expect(result.current.isLoading).toBe(false);
  });

  it('should return null data when no initial data is provided', async () => {
    const { useSpotifyPolling } = await import('../hooks/use-spotify-polling');

    const { result } = renderHook(() =>
      useSpotifyPolling({
        enabled: false,
      })
    );

    expect(result.current.data).toBeNull();
  });

  it('should not poll when enabled is false', async () => {
    const { useSpotifyPolling } = await import('../hooks/use-spotify-polling');

    renderHook(() =>
      useSpotifyPolling({
        initialData: mockSongData,
        enabled: false,
      })
    );

    // SWR should be called with null key when disabled
    expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Function), expect.any(Object));
  });

  it('should poll when enabled is true', async () => {
    const { useSpotifyPolling } = await import('../hooks/use-spotify-polling');

    renderHook(() =>
      useSpotifyPolling({
        initialData: mockSongData,
        enabled: true,
      })
    );

    // SWR should be called with the API endpoint
    expect(mockUseSWR).toHaveBeenCalledWith('/api/spotify/now-playing', expect.any(Function), expect.any(Object));
  });

  it('should provide resetChangeState function', async () => {
    const { useSpotifyPolling } = await import('../hooks/use-spotify-polling');

    const { result } = renderHook(() =>
      useSpotifyPolling({
        initialData: mockSongData,
      })
    );

    expect(typeof result.current.resetChangeState).toBe('function');
  });

  it('should initialize hasTrackChanged and hasPlayStateChanged as false', async () => {
    const { useSpotifyPolling } = await import('../hooks/use-spotify-polling');

    const { result } = renderHook(() =>
      useSpotifyPolling({
        initialData: mockSongData,
      })
    );

    expect(result.current.hasTrackChanged).toBe(false);
    expect(result.current.hasPlayStateChanged).toBe(false);
  });

  it('should reset change state when resetChangeState is called', async () => {
    const { useSpotifyPolling } = await import('../hooks/use-spotify-polling');

    const { result } = renderHook(() =>
      useSpotifyPolling({
        initialData: mockSongData,
      })
    );

    act(() => {
      result.current.resetChangeState();
    });

    expect(result.current.hasTrackChanged).toBe(false);
    expect(result.current.hasPlayStateChanged).toBe(false);
    expect(result.current.previousData).toBeNull();
  });

  it('should track visibility state changes', async () => {
    const { useSpotifyPolling } = await import('../hooks/use-spotify-polling');

    const { result } = renderHook(() =>
      useSpotifyPolling({
        initialData: mockSongData,
      })
    );

    // Simulate visibility change to hidden
    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // The hook should have updated its internal state
    // We can't directly test the internal state, but we can verify the hook doesn't crash
    expect(result.current.data).toEqual(mockSongData);
  });

  it('should use custom polling intervals', async () => {
    const { useSpotifyPolling } = await import('../hooks/use-spotify-polling');

    renderHook(() =>
      useSpotifyPolling({
        initialData: mockSongData,
        playingInterval: 3000,
        pausedInterval: 60000,
      })
    );

    // Verify SWR was called with options including refreshInterval function
    expect(mockUseSWR).toHaveBeenCalledWith(
      '/api/spotify/now-playing',
      expect.any(Function),
      expect.objectContaining({
        refreshInterval: expect.any(Function),
      })
    );
  });

  describe('fetcher 에러 핸들링', () => {
    it('should throw error when response is not ok', async () => {
      // Arrange
      const { useSpotifyPolling } = await import('../hooks/use-spotify-polling');
      renderHook(() => useSpotifyPolling({ enabled: true }));

      // useSWR에 전달된 fetcher 함수 추출
      const fetcherFn = mockUseSWR.mock.calls[mockUseSWR.mock.calls.length - 1]![1] as (
        url: string
      ) => Promise<unknown>;

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      // Act & Assert
      await expect(fetcherFn('/api/spotify/now-playing')).rejects.toThrow('Failed to fetch now playing');
    });

    it('should return json data when response is ok', async () => {
      // Arrange
      const { useSpotifyPolling } = await import('../hooks/use-spotify-polling');
      renderHook(() => useSpotifyPolling({ enabled: true }));

      const fetcherFn = mockUseSWR.mock.calls[mockUseSWR.mock.calls.length - 1]![1] as (
        url: string
      ) => Promise<unknown>;

      const expectedResponse = { data: mockSongData, timestamp: Date.now() };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(expectedResponse),
      });

      // Act
      const result = await fetcherFn('/api/spotify/now-playing');

      // Assert
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('적응형 폴링 간격', () => {
    function getRefreshIntervalFn(): (latest: { data: NowPlaying | null; timestamp: number } | undefined) => number {
      const swrOptions = mockUseSWR.mock.calls[mockUseSWR.mock.calls.length - 1]![2] as {
        refreshInterval: (latest: { data: NowPlaying | null; timestamp: number } | undefined) => number;
      };
      return swrOptions.refreshInterval;
    }

    it('returns 0 when polling is disabled', async () => {
      const { useSpotifyPolling } = await import('../hooks/use-spotify-polling');
      renderHook(() => useSpotifyPolling({ initialData: mockSongData, enabled: false }));

      expect(getRefreshIntervalFn()({ data: mockSongData, timestamp: Date.now() })).toBe(0);
    });

    it('returns pausedInterval when track is paused', async () => {
      const { useSpotifyPolling } = await import('../hooks/use-spotify-polling');
      renderHook(() => useSpotifyPolling({ initialData: mockSongData, pausedInterval: 30000 }));

      const paused: NowPlaying = { ...mockSongData, isPlaying: false };
      expect(getRefreshIntervalFn()({ data: paused, timestamp: Date.now() })).toBe(30000);
    });

    it('returns 2s interval when track is near the end (<10s remaining)', async () => {
      const { useSpotifyPolling } = await import('../hooks/use-spotify-polling');
      renderHook(() => useSpotifyPolling({ initialData: mockSongData }));

      const nearEnd: NowPlaying = { ...mockSongData, progressMs: 195_000, durationMs: 200_000 };
      expect(getRefreshIntervalFn()({ data: nearEnd, timestamp: Date.now() })).toBe(2000);
    });

    it('returns 3s interval when 10-30s remain', async () => {
      const { useSpotifyPolling } = await import('../hooks/use-spotify-polling');
      renderHook(() => useSpotifyPolling({ initialData: mockSongData }));

      const midToEnd: NowPlaying = { ...mockSongData, progressMs: 180_000, durationMs: 200_000 };
      expect(getRefreshIntervalFn()({ data: midToEnd, timestamp: Date.now() })).toBe(3000);
    });

    it('uses playingInterval for mid-song polling (>30s remaining)', async () => {
      const { useSpotifyPolling } = await import('../hooks/use-spotify-polling');
      renderHook(() => useSpotifyPolling({ initialData: mockSongData, playingInterval: 4000 }));

      const midSong: NowPlaying = { ...mockSongData, progressMs: 50_000, durationMs: 200_000 };
      expect(getRefreshIntervalFn()({ data: midSong, timestamp: Date.now() })).toBe(4000);
    });

    it('uses playingInterval fallback when progress/duration are unknown', async () => {
      const { useSpotifyPolling } = await import('../hooks/use-spotify-polling');
      renderHook(() => useSpotifyPolling({ initialData: mockSongData, playingInterval: 4000 }));

      const noProgress: NowPlaying = { ...mockSongData, progressMs: null, durationMs: null };
      expect(getRefreshIntervalFn()({ data: noProgress, timestamp: Date.now() })).toBe(4000);
    });

    it('accounts for elapsed time since fetch (drift correction)', async () => {
      const { useSpotifyPolling } = await import('../hooks/use-spotify-polling');
      renderHook(() => useSpotifyPolling({ initialData: mockSongData }));

      // 곡 시작 후 175s 지점, 200s 길이 — 잔여 25s이지만 fetch가 20초 전이라면 실제 잔여 5s
      const data: NowPlaying = { ...mockSongData, progressMs: 175_000, durationMs: 200_000 };
      const result = getRefreshIntervalFn()({ data, timestamp: Date.now() - 20_000 });
      expect(result).toBe(2000);
    });
  });

  describe('상태 변화 감지', () => {
    it('should detect track change when songUrl changes', async () => {
      // Arrange
      const { useSpotifyPolling } = await import('../hooks/use-spotify-polling');

      const newSongData: NowPlaying = {
        ...mockSongData,
        songUrl: 'https://open.spotify.com/track/new-track',
        title: 'New Song',
      };

      // 첫 렌더링: 초기 데이터
      swrReturnValue = {
        data: { data: mockSongData, timestamp: Date.now() },
        error: undefined,
        isLoading: false,
        mutate: mockMutate,
      };

      const { result, rerender } = renderHook(() =>
        useSpotifyPolling({
          initialData: mockSongData,
          enabled: true,
        })
      );

      // 초기 상태 확인
      expect(result.current.hasTrackChanged).toBe(false);
      expect(result.current.previousData).toBeNull();

      // Act - 곡 변경
      act(() => {
        swrReturnValue = {
          data: { data: newSongData, timestamp: Date.now() },
          error: undefined,
          isLoading: false,
          mutate: mockMutate,
        };
      });

      rerender();

      // Assert (lines 122-124 커버)
      expect(result.current.hasTrackChanged).toBe(true);
      expect(result.current.previousData).toEqual(mockSongData);
      expect(result.current.data).toEqual(newSongData);
    });

    it('should detect play state change when isPlaying changes', async () => {
      // Arrange
      const { useSpotifyPolling } = await import('../hooks/use-spotify-polling');

      const pausedSongData: NowPlaying = {
        ...mockSongData,
        isPlaying: false,
      };

      swrReturnValue = {
        data: { data: mockSongData, timestamp: Date.now() },
        error: undefined,
        isLoading: false,
        mutate: mockMutate,
      };

      const { result, rerender } = renderHook(() =>
        useSpotifyPolling({
          initialData: mockSongData,
          enabled: true,
        })
      );

      expect(result.current.hasPlayStateChanged).toBe(false);

      // Act - 재생 상태 변경 (isPlaying: true -> false)
      act(() => {
        swrReturnValue = {
          data: { data: pausedSongData, timestamp: Date.now() },
          error: undefined,
          isLoading: false,
          mutate: mockMutate,
        };
      });

      rerender();

      // Assert (lines 128-129 커버)
      expect(result.current.hasPlayStateChanged).toBe(true);
    });

    it('should not detect changes when data is the same', async () => {
      // Arrange
      const { useSpotifyPolling } = await import('../hooks/use-spotify-polling');

      swrReturnValue = {
        data: { data: mockSongData, timestamp: Date.now() },
        error: undefined,
        isLoading: false,
        mutate: mockMutate,
      };

      const { result, rerender } = renderHook(() =>
        useSpotifyPolling({
          initialData: mockSongData,
          enabled: true,
        })
      );

      // Act - 같은 데이터로 리렌더
      rerender();

      // Assert
      expect(result.current.hasTrackChanged).toBe(false);
      expect(result.current.hasPlayStateChanged).toBe(false);
    });

    it('should handle null currentData without errors', async () => {
      // Arrange - initialData 없이 SWR이 null을 반환하는 경우
      const { useSpotifyPolling } = await import('../hooks/use-spotify-polling');

      swrReturnValue = {
        data: { data: null, timestamp: Date.now() },
        error: undefined,
        isLoading: false,
        mutate: mockMutate,
      };

      // Act
      const { result } = renderHook(() =>
        useSpotifyPolling({
          enabled: true,
        })
      );

      // Assert - currentData가 null일 때 에러 없이 동작
      expect(result.current.data).toBeNull();
      expect(result.current.hasTrackChanged).toBe(false);
      expect(result.current.hasPlayStateChanged).toBe(false);
    });
  });
});
