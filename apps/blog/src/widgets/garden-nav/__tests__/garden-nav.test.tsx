import { render, screen } from '@testing-library/react';

import type { NoteStatus } from '@/src/entities/note';

import { GardenNav } from '../ui/garden-nav';

import '@testing-library/jest-dom';

const mockUsePathname = jest.fn(() => '/garden');

jest.mock('@/src/shared/config/i18n', () => ({
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  usePathname: () => mockUsePathname(),
}));

const statusLabels: Record<NoteStatus, string> = {
  seedling: '새싹',
  budding: '성장 중',
  evergreen: '완성',
};

const renderNav = () => render(<GardenNav allLabel="전체" statusLabels={statusLabels} tagsLabel="태그" />);

const ACTIVE_CLASS_FRAGMENT = 'bg-background';
const INACTIVE_CLASS_FRAGMENT = 'dark:text-muted-foreground';

describe('GardenNav', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/garden');
  });

  it('renders all/status/tags links with correct hrefs', () => {
    renderNav();

    expect(screen.getByRole('link', { name: '전체' })).toHaveAttribute('href', '/garden');
    expect(screen.getByRole('link', { name: '새싹' })).toHaveAttribute('href', '/garden/status/seedling');
    expect(screen.getByRole('link', { name: '성장 중' })).toHaveAttribute('href', '/garden/status/budding');
    expect(screen.getByRole('link', { name: '완성' })).toHaveAttribute('href', '/garden/status/evergreen');
    expect(screen.getByRole('link', { name: /태그/ })).toHaveAttribute('href', '/garden/tags');
  });

  it('marks "all" link active on /garden', () => {
    renderNav();

    expect(screen.getByRole('link', { name: '전체' })).toHaveClass(ACTIVE_CLASS_FRAGMENT);
    expect(screen.getByRole('link', { name: '새싹' })).toHaveClass(INACTIVE_CLASS_FRAGMENT);
  });

  it.each([
    ['seedling', '새싹'],
    ['budding', '성장 중'],
    ['evergreen', '완성'],
  ] as const)('marks %s active when on /garden/status/%s', (status, label) => {
    mockUsePathname.mockReturnValue(`/garden/status/${status}`);

    renderNav();

    expect(screen.getByRole('link', { name: label })).toHaveClass(ACTIVE_CLASS_FRAGMENT);
    expect(screen.getByRole('link', { name: '전체' })).not.toHaveClass(ACTIVE_CLASS_FRAGMENT);
  });

  it('marks tags link active for /garden/tags and nested paths', () => {
    mockUsePathname.mockReturnValue('/garden/tags/typescript');

    renderNav();

    expect(screen.getByRole('link', { name: /태그/ })).toHaveClass(ACTIVE_CLASS_FRAGMENT);
    expect(screen.getByRole('link', { name: '전체' })).not.toHaveClass(ACTIVE_CLASS_FRAGMENT);
  });
});
