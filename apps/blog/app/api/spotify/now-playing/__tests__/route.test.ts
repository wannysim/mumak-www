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

describe('GET /api/spotify/now-playing', () => {
  beforeEach(() => {
    mockGetNowPlaying.mockReset();
  });

  it('disables caching to keep now-playing data realtime', async () => {
    mockGetNowPlaying.mockResolvedValueOnce(basePlaying);
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

  it('returns null data when getNowPlaying returns null', async () => {
    mockGetNowPlaying.mockResolvedValueOnce(null);
    const { GET } = await import('../route');

    const response = await GET();
    const body = await response.json();
    expect(body.data).toBeNull();
  });
});
