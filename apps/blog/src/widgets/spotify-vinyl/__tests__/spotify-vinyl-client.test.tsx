import { act, render, screen } from '@testing-library/react';

import type { NowPlaying } from '@/src/entities/spotify';

import '@testing-library/jest-dom';

const mockUseSpotifyPolling = jest.fn();
const mockUseProgressInterpolation = jest.fn();

jest.mock('@/src/features/spotify-polling', () => ({
  useSpotifyPolling: (...args: unknown[]) => mockUseSpotifyPolling(...args),
  useProgressInterpolation: (...args: unknown[]) => mockUseProgressInterpolation(...args),
}));

jest.mock('../ui/spotify-vinyl', () => ({
  SpotifyVinyl: ({
    data,
    statusLabel,
    isTransitioning,
    interpolatedProgressMs,
  }: {
    data: NowPlaying;
    statusLabel: string;
    isTransitioning?: boolean;
    interpolatedProgressMs?: number | null;
  }) => (
    <div
      data-testid="spotify-vinyl"
      data-transitioning={isTransitioning ? 'true' : 'false'}
      data-progress={interpolatedProgressMs ?? 'null'}
    >
      <span data-testid="status-label">{statusLabel}</span>
      <span data-testid="title">{data.title}</span>
    </div>
  ),
}));

jest.mock('../ui/spotify-vinyl-skeleton', () => ({
  SpotifyVinylSkeleton: () => <div data-testid="spotify-vinyl-skeleton" />,
}));

const playingData: NowPlaying = {
  isPlaying: true,
  title: 'Live Track',
  artist: 'Artist',
  album: 'Album',
  albumImageUrl: 'https://i.scdn.co/x.jpg',
  songUrl: 'https://open.spotify.com/track/x',
  isExplicit: false,
  progressMs: 30000,
  durationMs: 180000,
  device: { name: 'MacBook Pro', type: 'Computer' },
};

const lastPlayedData: NowPlaying = {
  ...playingData,
  isPlaying: false,
  title: 'Recent Track',
  progressMs: null,
  device: null,
};

function setupHookReturn(overrides: Partial<ReturnType<typeof defaultHookReturn>> = {}) {
  mockUseSpotifyPolling.mockReturnValue({ ...defaultHookReturn(), ...overrides });
}

function defaultHookReturn() {
  return {
    data: null as NowPlaying | null,
    previousData: null as NowPlaying | null,
    isLoading: false,
    error: undefined,
    hasTrackChanged: false,
    hasPlayStateChanged: false,
    resetChangeState: jest.fn(),
    fetchedAt: 0,
  };
}

describe('SpotifyVinylClient', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockUseSpotifyPolling.mockReset();
    mockUseProgressInterpolation.mockReset();
    mockUseProgressInterpolation.mockReturnValue({ progressMs: null, durationMs: null });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders skeleton when no data and no initial data', async () => {
    setupHookReturn({ data: null });
    const { SpotifyVinylClient } = await import('../ui/spotify-vinyl-client');

    render(<SpotifyVinylClient initialData={null} listeningToLabel="Listening to" lastPlayedLabel="Last played" />);

    expect(screen.getByTestId('spotify-vinyl-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('spotify-vinyl')).not.toBeInTheDocument();
  });

  it('falls back to initialData when polling has no data yet', async () => {
    setupHookReturn({ data: null });
    const { SpotifyVinylClient } = await import('../ui/spotify-vinyl-client');

    render(
      <SpotifyVinylClient initialData={playingData} listeningToLabel="Listening to" lastPlayedLabel="Last played" />
    );

    expect(screen.getByTestId('title')).toHaveTextContent('Live Track');
    expect(screen.getByTestId('status-label')).toHaveTextContent('Listening to');
  });

  it('uses lastPlayedLabel when isPlaying is false', async () => {
    setupHookReturn({ data: lastPlayedData });
    const { SpotifyVinylClient } = await import('../ui/spotify-vinyl-client');

    render(<SpotifyVinylClient initialData={null} listeningToLabel="Listening to" lastPlayedLabel="Last played" />);

    expect(screen.getByTestId('status-label')).toHaveTextContent('Last played');
  });

  it('passes hasTrackChanged as isTransitioning to SpotifyVinyl', async () => {
    setupHookReturn({ data: playingData, hasTrackChanged: true });
    const { SpotifyVinylClient } = await import('../ui/spotify-vinyl-client');

    render(<SpotifyVinylClient initialData={null} listeningToLabel="Listening to" lastPlayedLabel="Last played" />);

    expect(screen.getByTestId('spotify-vinyl')).toHaveAttribute('data-transitioning', 'true');
  });

  it('calls resetChangeState 500ms after a track change', async () => {
    const resetChangeState = jest.fn();
    setupHookReturn({ data: playingData, hasTrackChanged: true, resetChangeState });
    const { SpotifyVinylClient } = await import('../ui/spotify-vinyl-client');

    render(<SpotifyVinylClient initialData={null} listeningToLabel="Listening to" lastPlayedLabel="Last played" />);

    expect(resetChangeState).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(resetChangeState).toHaveBeenCalledTimes(1);
  });

  it('also triggers reset on play state change', async () => {
    const resetChangeState = jest.fn();
    setupHookReturn({ data: playingData, hasPlayStateChanged: true, resetChangeState });
    const { SpotifyVinylClient } = await import('../ui/spotify-vinyl-client');

    render(<SpotifyVinylClient initialData={null} listeningToLabel="Listening to" lastPlayedLabel="Last played" />);

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(resetChangeState).toHaveBeenCalledTimes(1);
  });

  it('does not schedule reset when no change is pending', async () => {
    const resetChangeState = jest.fn();
    setupHookReturn({ data: playingData, hasTrackChanged: false, hasPlayStateChanged: false, resetChangeState });
    const { SpotifyVinylClient } = await import('../ui/spotify-vinyl-client');

    render(<SpotifyVinylClient initialData={null} listeningToLabel="Listening to" lastPlayedLabel="Last played" />);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(resetChangeState).not.toHaveBeenCalled();
  });

  it('passes interpolated progress to SpotifyVinyl', async () => {
    setupHookReturn({ data: playingData, fetchedAt: 1000 });
    mockUseProgressInterpolation.mockReturnValue({ progressMs: 42_000, durationMs: 180_000 });

    const { SpotifyVinylClient } = await import('../ui/spotify-vinyl-client');

    render(<SpotifyVinylClient initialData={null} listeningToLabel="Listening to" lastPlayedLabel="Last played" />);

    expect(mockUseProgressInterpolation).toHaveBeenCalledWith(
      expect.objectContaining({
        trackId: playingData.songUrl,
        progressMs: 30000,
        durationMs: 180000,
        isPlaying: true,
        fetchedAt: 1000,
      })
    );
    expect(screen.getByTestId('spotify-vinyl')).toHaveAttribute('data-progress', '42000');
  });

  it('clears the timer when unmounted before 500ms elapses', async () => {
    const resetChangeState = jest.fn();
    setupHookReturn({ data: playingData, hasTrackChanged: true, resetChangeState });
    const { SpotifyVinylClient } = await import('../ui/spotify-vinyl-client');

    const { unmount } = render(
      <SpotifyVinylClient initialData={null} listeningToLabel="Listening to" lastPlayedLabel="Last played" />
    );

    unmount();

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(resetChangeState).not.toHaveBeenCalled();
  });
});
