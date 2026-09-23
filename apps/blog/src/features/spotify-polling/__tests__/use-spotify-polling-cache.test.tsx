import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { SWRConfig } from 'swr';

import { useSpotifyPolling } from '../hooks/use-spotify-polling';

const song = {
  isPlaying: true,
  title: 'Cached track',
  artist: 'Artist',
  album: 'Album',
  albumImageUrl: 'https://i.scdn.co/test.jpg',
  songUrl: 'https://open.spotify.com/track/test',
  isExplicit: false,
  progressMs: 1000,
  durationMs: 60000,
  device: null,
};

describe('useSpotifyPolling shared cache', () => {
  it('shows the last track immediately after the widget remounts', async () => {
    const cache = new Map();
    const originalFetch = global.fetch;
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: song, timestamp: Date.now() }),
    } as Response);
    global.fetch = fetchSpy;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SWRConfig value={{ provider: () => cache, dedupingInterval: 60_000 }}>{children}</SWRConfig>
    );

    try {
      const firstVisit = renderHook(() => useSpotifyPolling({ playingInterval: 60_000 }), { wrapper });
      await waitFor(() => expect(firstVisit.result.current.data).toEqual(song));
      firstVisit.unmount();

      const returnVisit = renderHook(() => useSpotifyPolling({ playingInterval: 60_000 }), { wrapper });
      expect(returnVisit.result.current.data).toEqual(song);
      expect(returnVisit.result.current.isLoading).toBe(false);
      returnVisit.unmount();
      expect(fetchSpy).toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });
});
