import { render, screen } from '@testing-library/react';

import type { NowPlaying } from '@/src/entities/spotify';

import '@testing-library/jest-dom';

// next/cache mock (cacheLife 등 서버 전용 API)
jest.mock('next/cache', () => ({
  cacheLife: jest.fn(),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, priority }: { src: string; alt: string; priority?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-priority={priority ? 'true' : 'false'} />
  ),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('@mumak/ui/components/skeleton', () => ({
  Skeleton: ({ className }: { className: string }) => (
    <div data-slot="skeleton" className={`animate-pulse ${className}`} />
  ),
}));

const mockGetNowPlayingDirect = jest.fn<Promise<NowPlaying | null>, []>();

jest.mock('@/src/entities/spotify', () => ({
  getNowPlayingDirect: () => mockGetNowPlayingDirect(),
}));

describe('SpotifyVinylServer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render skeleton when no song data is available', async () => {
    mockGetNowPlayingDirect.mockResolvedValue(null);

    const { SpotifyVinylServer } = await import('../ui/spotify-vinyl-server');
    const Component = await SpotifyVinylServer({
      listeningToLabel: 'Listening to',
      lastPlayedLabel: 'Last played',
    });

    const { container } = render(Component);

    // Should render skeleton (has skeleton elements)
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render SpotifyVinyl with "Listening to" label when isPlaying is true', async () => {
    mockGetNowPlayingDirect.mockResolvedValue({
      isPlaying: true,
      title: 'Test Song',
      artist: 'Test Artist',
      album: 'Test Album',
      albumImageUrl: 'https://i.scdn.co/test.jpg',
      songUrl: 'https://open.spotify.com/track/test',
      isExplicit: false,
    });

    const { SpotifyVinylServer } = await import('../ui/spotify-vinyl-server');
    const Component = await SpotifyVinylServer({
      listeningToLabel: 'Listening to',
      lastPlayedLabel: 'Last played',
    });

    render(Component);

    expect(screen.getByText('Listening to')).toBeInTheDocument();
    expect(screen.getByText('Test Song')).toBeInTheDocument();
    expect(screen.getByText('Test Artist')).toBeInTheDocument();
  });

  it('should render SpotifyVinyl with "Last played" label when isPlaying is false', async () => {
    mockGetNowPlayingDirect.mockResolvedValue({
      isPlaying: false,
      title: 'Recent Song',
      artist: 'Recent Artist',
      album: 'Recent Album',
      albumImageUrl: 'https://i.scdn.co/recent.jpg',
      songUrl: 'https://open.spotify.com/track/recent',
      isExplicit: false,
    });

    const { SpotifyVinylServer } = await import('../ui/spotify-vinyl-server');
    const Component = await SpotifyVinylServer({
      listeningToLabel: 'Listening to',
      lastPlayedLabel: 'Last played',
    });

    render(Component);

    expect(screen.getByText('Last played')).toBeInTheDocument();
    expect(screen.getByText('Recent Song')).toBeInTheDocument();
    expect(screen.getByText('Recent Artist')).toBeInTheDocument();
  });

  it('should render skeleton when getNowPlaying throws an error', async () => {
    mockGetNowPlayingDirect.mockRejectedValue(new Error('API Error'));

    const { SpotifyVinylServer } = await import('../ui/spotify-vinyl-server');
    const Component = await SpotifyVinylServer({
      listeningToLabel: 'Listening to',
      lastPlayedLabel: 'Last played',
    });

    const { container } = render(Component);

    // Should render skeleton on error
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render album cover with correct alt text', async () => {
    mockGetNowPlayingDirect.mockResolvedValue({
      isPlaying: true,
      title: 'Test Song',
      artist: 'Test Artist',
      album: 'Test Album',
      albumImageUrl: 'https://i.scdn.co/test.jpg',
      songUrl: 'https://open.spotify.com/track/test',
      isExplicit: false,
    });

    const { SpotifyVinylServer } = await import('../ui/spotify-vinyl-server');
    const Component = await SpotifyVinylServer({
      listeningToLabel: 'Listening to',
      lastPlayedLabel: 'Last played',
    });

    render(Component);

    const coverImage = screen.getByAltText('Test Album cover art');
    expect(coverImage).toBeInTheDocument();
    expect(coverImage).toHaveAttribute('src', 'https://i.scdn.co/test.jpg');
  });

  it('should render Spotify link to song', async () => {
    mockGetNowPlayingDirect.mockResolvedValue({
      isPlaying: true,
      title: 'Test Song',
      artist: 'Test Artist',
      album: 'Test Album',
      albumImageUrl: 'https://i.scdn.co/test.jpg',
      songUrl: 'https://open.spotify.com/track/test',
      isExplicit: false,
    });

    const { SpotifyVinylServer } = await import('../ui/spotify-vinyl-server');
    const Component = await SpotifyVinylServer({
      listeningToLabel: 'Listening to',
      lastPlayedLabel: 'Last played',
    });

    const { container } = render(Component);

    const link = container.querySelector('a');
    expect(link).toHaveAttribute('href', 'https://open.spotify.com/track/test');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should pass i18n labels correctly', async () => {
    mockGetNowPlayingDirect.mockResolvedValue({
      isPlaying: true,
      title: 'Test Song',
      artist: 'Test Artist',
      album: 'Test Album',
      albumImageUrl: 'https://i.scdn.co/test.jpg',
      songUrl: 'https://open.spotify.com/track/test',
      isExplicit: false,
    });

    const { SpotifyVinylServer } = await import('../ui/spotify-vinyl-server');
    const Component = await SpotifyVinylServer({
      listeningToLabel: '듣는 중',
      lastPlayedLabel: '최근 재생',
    });

    render(Component);

    expect(screen.getByText('듣는 중')).toBeInTheDocument();
  });
});
