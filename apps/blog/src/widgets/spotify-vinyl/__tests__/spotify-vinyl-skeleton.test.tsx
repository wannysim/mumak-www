import { render } from '@testing-library/react';

import '@testing-library/jest-dom';

jest.mock('@mumak/ui/components/skeleton', () => ({
  Skeleton: ({ className }: { className: string }) => (
    <div data-slot="skeleton" className={`animate-pulse ${className}`} />
  ),
}));

describe('SpotifyVinylSkeleton', () => {
  it('should render skeleton UI with correct structure', async () => {
    const { SpotifyVinylSkeleton } = await import('../ui/spotify-vinyl-skeleton');

    const { container } = render(<SpotifyVinylSkeleton />);

    // Check wrapper
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('w-full', 'max-w-md', 'p-4');
  });

  it('should render LP disc skeleton', async () => {
    const { SpotifyVinylSkeleton } = await import('../ui/spotify-vinyl-skeleton');

    const { container } = render(<SpotifyVinylSkeleton />);

    // LP disc skeleton
    const lpDisc = container.querySelector('.rounded-full.bg-neutral-900\\/50');
    expect(lpDisc).toBeInTheDocument();
    expect(lpDisc).toHaveClass('absolute', 'left-0');
  });

  it('should render album sleeve skeleton', async () => {
    const { SpotifyVinylSkeleton } = await import('../ui/spotify-vinyl-skeleton');

    const { container } = render(<SpotifyVinylSkeleton />);

    // Album sleeve skeleton (first Skeleton component) - matches actual sleeve radius
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    const albumSkeleton = skeletons[0];
    expect(albumSkeleton).toHaveClass('rounded', 'lg:rounded-lg');
  });

  it('should render track info skeletons including status, progress and time rows', async () => {
    const { SpotifyVinylSkeleton } = await import('../ui/spotify-vinyl-skeleton');

    const { container } = render(<SpotifyVinylSkeleton />);

    // 1 album + 2 status row (icon + label) + title + artist + 1 progress bar + 2 time = 8 skeletons
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(8);

    // All skeletons should have animate-pulse
    skeletons.forEach(skeleton => {
      expect(skeleton).toHaveClass('animate-pulse');
    });
  });

  it('should have correct z-index layering', async () => {
    const { SpotifyVinylSkeleton } = await import('../ui/spotify-vinyl-skeleton');

    const { container } = render(<SpotifyVinylSkeleton />);

    // Album sleeve container should have z-10
    const albumContainer = container.querySelector('.z-10');
    expect(albumContainer).toBeInTheDocument();
  });

  it('should match layout with actual component', async () => {
    const { SpotifyVinylSkeleton } = await import('../ui/spotify-vinyl-skeleton');

    const { container } = render(<SpotifyVinylSkeleton />);

    // Check flex layout
    const flexContainer = container.querySelector('.flex.items-center');
    expect(flexContainer).toBeInTheDocument();

    // Check track info container spacing - matches actual component (ml-8 sm:ml-14 pl-2)
    const trackInfoContainer = container.querySelector('.ml-8.sm\\:ml-14.pl-2');
    expect(trackInfoContainer).toBeInTheDocument();
  });
});
