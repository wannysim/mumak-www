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

  it('uses the steady cache header during mid-song playback', async () => {
    mockGetNowPlaying.mockResolvedValueOnce({ ...basePlaying, progressMs: 50_000, durationMs: 200_000 });
    const { GET } = await import('../route');

    const response = await GET();
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=10, stale-while-revalidate=30');
  });

  it('shortens the cache when the track is about to end (<15s remaining)', async () => {
    mockGetNowPlaying.mockResolvedValueOnce({ ...basePlaying, progressMs: 190_000, durationMs: 200_000 });
    const { GET } = await import('../route');

    const response = await GET();
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=2, stale-while-revalidate=10');
  });

  it('uses the steady cache header when paused', async () => {
    mockGetNowPlaying.mockResolvedValueOnce({ ...basePlaying, isPlaying: false, progressMs: 190_000 });
    const { GET } = await import('../route');

    const response = await GET();
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=10, stale-while-revalidate=30');
  });

  it('uses the steady cache header when progress data is missing', async () => {
    mockGetNowPlaying.mockResolvedValueOnce({ ...basePlaying, progressMs: null, durationMs: null });
    const { GET } = await import('../route');

    const response = await GET();
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=10, stale-while-revalidate=30');
  });

  it('uses the steady cache header when data is null (fallback path)', async () => {
    mockGetNowPlaying.mockResolvedValueOnce(null);
    const { GET } = await import('../route');

    const response = await GET();
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=10, stale-while-revalidate=30');
  });
});
