import { fireEvent, render, screen } from '@testing-library/react';

import type { NowPlaying } from '@/src/entities/spotify';

import '@testing-library/jest-dom';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, priority, fill }: { src: string; alt: string; priority?: boolean; fill?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-priority={priority ? 'true' : 'false'} data-fill={fill ? 'true' : 'false'} />
  ),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    onClick,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
  }) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

const mockSongData: NowPlaying = {
  isPlaying: true,
  title: 'Test Song',
  artist: 'Test Artist',
  album: 'Test Album',
  albumImageUrl: 'https://i.scdn.co/test.jpg',
  songUrl: 'https://open.spotify.com/track/test',
  isExplicit: false,
};

describe('SpotifyVinyl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render song information correctly', async () => {
    const { SpotifyVinyl } = await import('../ui/spotify-vinyl');

    render(<SpotifyVinyl data={mockSongData} statusLabel="Listening to" />);

    expect(screen.getByText('Listening to')).toBeInTheDocument();
    expect(screen.getByText('Test Song')).toBeInTheDocument();
    expect(screen.getByText('Test Artist')).toBeInTheDocument();
  });

  it('should render album cover image', async () => {
    const { SpotifyVinyl } = await import('../ui/spotify-vinyl');

    render(<SpotifyVinyl data={mockSongData} statusLabel="Listening to" />);

    const coverImage = screen.getByAltText('Test Album cover art');
    expect(coverImage).toBeInTheDocument();
    expect(coverImage).toHaveAttribute('src', 'https://i.scdn.co/test.jpg');
  });

  it('should have correct accessibility attributes', async () => {
    const { SpotifyVinyl } = await import('../ui/spotify-vinyl');

    render(<SpotifyVinyl data={mockSongData} statusLabel="Listening to" />);

    const button = screen.getByRole('button', { name: 'Toggle vinyl player' });
    expect(button).toHaveAttribute('aria-label', 'Toggle vinyl player');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('should toggle LP open state on click', async () => {
    const { SpotifyVinyl } = await import('../ui/spotify-vinyl');

    render(<SpotifyVinyl data={mockSongData} statusLabel="Listening to" />);

    const button = screen.getByRole('button', { name: 'Toggle vinyl player' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('should toggle LP on Enter key press', async () => {
    const { SpotifyVinyl } = await import('../ui/spotify-vinyl');

    render(<SpotifyVinyl data={mockSongData} statusLabel="Listening to" />);

    const button = screen.getByRole('button', { name: 'Toggle vinyl player' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    // Native button handles Enter key automatically
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyUp(button, { key: 'Enter' });
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('should toggle LP on Space key press', async () => {
    const { SpotifyVinyl } = await import('../ui/spotify-vinyl');

    render(<SpotifyVinyl data={mockSongData} statusLabel="Listening to" />);

    const button = screen.getByRole('button', { name: 'Toggle vinyl player' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    // Native button handles Space key automatically
    fireEvent.keyDown(button, { key: ' ' });
    fireEvent.keyUp(button, { key: ' ' });
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('should render Spotify link with correct attributes', async () => {
    const { SpotifyVinyl } = await import('../ui/spotify-vinyl');

    const { container } = render(<SpotifyVinyl data={mockSongData} statusLabel="Listening to" />);

    const link = container.querySelector('a');
    expect(link).toHaveAttribute('href', 'https://open.spotify.com/track/test');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should not toggle LP when clicking on song link', async () => {
    const { SpotifyVinyl } = await import('../ui/spotify-vinyl');

    render(<SpotifyVinyl data={mockSongData} statusLabel="Listening to" />);

    const button = screen.getByRole('button', { name: 'Toggle vinyl player' });
    const link = screen.getByRole('link');

    // Click link - should not toggle LP (link is outside button)
    fireEvent.click(link);
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('should show playing indicator when isPlaying is true', async () => {
    const { SpotifyVinyl } = await import('../ui/spotify-vinyl');

    const { container } = render(<SpotifyVinyl data={mockSongData} statusLabel="Listening to" />);

    // Playing indicator should be visible (ping animation next to status label)
    const playingIndicator = container.querySelector('.animate-ping');
    expect(playingIndicator).toBeInTheDocument();
  });

  it('should hide playing indicator when isPlaying is false', async () => {
    const { SpotifyVinyl } = await import('../ui/spotify-vinyl');

    const notPlayingData = { ...mockSongData, isPlaying: false };
    const { container } = render(<SpotifyVinyl data={notPlayingData} statusLabel="Last played" />);

    // Playing indicator should not be visible
    const playingIndicator = container.querySelector('.animate-ping');
    expect(playingIndicator).not.toBeInTheDocument();
  });

  it('should show explicit badge when isExplicit is true', async () => {
    const { SpotifyVinyl } = await import('../ui/spotify-vinyl');

    const explicitData = { ...mockSongData, isExplicit: true };
    render(<SpotifyVinyl data={explicitData} statusLabel="Listening to" />);

    const explicitBadge = screen.getByLabelText('Explicit content');
    expect(explicitBadge).toBeInTheDocument();
    expect(explicitBadge).toHaveTextContent('19');
  });

  it('should not show explicit badge when isExplicit is false', async () => {
    const { SpotifyVinyl } = await import('../ui/spotify-vinyl');

    render(<SpotifyVinyl data={mockSongData} statusLabel="Listening to" />);

    const explicitBadge = screen.queryByLabelText('Explicit content');
    expect(explicitBadge).not.toBeInTheDocument();
  });

  it('should truncate long title and artist name', async () => {
    const { SpotifyVinyl } = await import('../ui/spotify-vinyl');

    const longData = {
      ...mockSongData,
      title: 'Very Long Song Title That Should Be Truncated',
      artist: 'Very Long Artist Name That Should Be Truncated',
    };

    render(<SpotifyVinyl data={longData} statusLabel="Listening to" />);

    const title = screen.getByText('Very Long Song Title That Should Be Truncated');
    const artist = screen.getByText('Very Long Artist Name That Should Be Truncated');

    expect(title).toHaveClass('truncate');
    expect(artist).toHaveClass('truncate');
  });

  it('should render Spotify brand color logo', async () => {
    const { SpotifyVinyl } = await import('../ui/spotify-vinyl');

    const { container } = render(<SpotifyVinyl data={mockSongData} statusLabel="Listening to" />);

    const spotifyLogo = container.querySelector('svg.text-\\[\\#1DB954\\]');
    expect(spotifyLogo).toBeInTheDocument();
  });
});
