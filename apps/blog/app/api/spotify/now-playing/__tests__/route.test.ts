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
  progressMs: 50_000,
  durationMs: 200_000,
  device: { name: 'Mac', type: 'Computer' },
};

describe('GET /api/spotify/now-playing', () => {
  beforeEach(() => {
    mockGetNowPlaying.mockReset();
  });

  it('disables edge cache while a track is actively playing so external pauses surface immediately', async () => {
    mockGetNowPlaying.mockResolvedValueOnce(basePlaying);
    const { GET } = await import('../route');

    const response = await GET();
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate');
  });

  it('caches paused responses (device present, isPlaying false)', async () => {
    mockGetNowPlaying.mockResolvedValueOnce({ ...basePlaying, isPlaying: false });
    const { GET } = await import('../route');

    const response = await GET();
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=30, stale-while-revalidate=120');
  });

  it('caches lastPlayed fallback more aggressively (no device)', async () => {
    mockGetNowPlaying.mockResolvedValueOnce({ ...basePlaying, isPlaying: false, device: null });
    const { GET } = await import('../route');

    const response = await GET();
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=60, stale-while-revalidate=300');
  });

  it('disables caching when data is null (API/network error)', async () => {
    mockGetNowPlaying.mockResolvedValueOnce(null);
    const { GET } = await import('../route');

    const response = await GET();
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate');
  });

  it('returns the data and a timestamp', async () => {
    mockGetNowPlaying.mockResolvedValueOnce(basePlaying);
    const { GET } = await import('../route');

    const response = await GET();
    const body = await response.json();
    expect(body.data).toEqual(basePlaying);
    expect(typeof body.timestamp).toBe('number');
  });
});
