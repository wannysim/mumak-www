/**
 * @jest-environment node
 */
import type { NowPlaying } from '@/src/entities/spotify';

const mockGetNowPlaying = jest.fn();

jest.mock('@/src/entities/spotify', () => ({
  getNowPlaying: () => mockGetNowPlaying(),
}));

const basePlaying: NowPlaying = {
  isPlaying: true,
  title: 'Test',
  artist: 'Artist',
  album: 'Album',
  albumImageUrl: '',
  songUrl: 'https://open.spotify.com/track/x',
  isExplicit: false,
  progressMs: 0,
  durationMs: 200_000,
  device: { name: 'Mac', type: 'Computer' },
};

describe('GET /api/spotify/now-playing — Cache-Control', () => {
  beforeEach(() => {
    mockGetNowPlaying.mockReset();
  });

  it('uses the playing cache header during mid-song playback', async () => {
    mockGetNowPlaying.mockResolvedValueOnce({ ...basePlaying, progressMs: 50_000, durationMs: 200_000 });
    const { GET } = await import('../route');

    const response = await GET();
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=3, stale-while-revalidate=15');
  });

  it('uses approaching-end cache when 10-30s remain', async () => {
    mockGetNowPlaying.mockResolvedValueOnce({ ...basePlaying, progressMs: 180_000, durationMs: 200_000 });
    const { GET } = await import('../route');

    const response = await GET();
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=2, stale-while-revalidate=10');
  });

  it('uses near-end cache when track has <10s remaining', async () => {
    mockGetNowPlaying.mockResolvedValueOnce({ ...basePlaying, progressMs: 195_000, durationMs: 200_000 });
    const { GET } = await import('../route');

    const response = await GET();
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=1, stale-while-revalidate=5');
  });

  it('uses the paused cache header when not playing', async () => {
    mockGetNowPlaying.mockResolvedValueOnce({ ...basePlaying, isPlaying: false, progressMs: 190_000 });
    const { GET } = await import('../route');

    const response = await GET();
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=10, stale-while-revalidate=30');
  });

  it('uses the playing cache header when progress data is missing', async () => {
    mockGetNowPlaying.mockResolvedValueOnce({ ...basePlaying, progressMs: null, durationMs: null });
    const { GET } = await import('../route');

    const response = await GET();
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=3, stale-while-revalidate=15');
  });

  it('uses the paused cache header when data is null (fallback path)', async () => {
    mockGetNowPlaying.mockResolvedValueOnce(null);
    const { GET } = await import('../route');

    const response = await GET();
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=10, stale-while-revalidate=30');
  });
});
