import { render, screen } from '@testing-library/react';

import type { PostMeta } from '@/src/entities/post';

import { PostCard } from '../ui/post-card';

import '@testing-library/jest-dom';

// Mock next-intl/server
jest.mock('next-intl/server', () => ({
  getTranslations: jest.fn(async () => (key: string) => {
    const translations: Record<string, string> = {
      readingTimeUnit: '분',
      readMore: '더 읽기',
    };
    return translations[key] ?? key;
  }),
}));

// Mock next/link
jest.mock('@/src/shared/config/i18n', () => ({
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// Mock date formatting
jest.mock('@/src/shared/lib/date', () => ({
  formatDateForLocale: (date: string) => ({
    text: '2024년 1월 1일',
    dateTime: date,
  }),
}));

// Mock Badge component
jest.mock('@mumak/ui/components/badge', () => ({
  Badge: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}));

const mockPost: PostMeta = {
  slug: 'test-post',
  title: 'Test Post Title',
  date: '2024-01-01',
  description: 'Test post description',
  category: 'articles',
  readingTime: 5,
};

async function renderPostCard(props: Partial<Parameters<typeof PostCard>[0]> = {}) {
  const element = await PostCard({ post: mockPost, locale: 'ko', ...props });
  return render(element);
}

describe('PostCard', () => {
  it('should render post title', async () => {
    await renderPostCard();

    expect(screen.getByText('Test Post Title')).toBeInTheDocument();
  });

  it('should render post description', async () => {
    await renderPostCard();

    expect(screen.getByText('Test post description')).toBeInTheDocument();
  });

  it('should render formatted date', async () => {
    await renderPostCard();

    expect(screen.getByText('2024년 1월 1일')).toBeInTheDocument();
  });

  it('should render reading time with unit', async () => {
    await renderPostCard();

    expect(screen.getByText(/5/)).toBeInTheDocument();
    expect(screen.getByText(/분/)).toBeInTheDocument();
  });

  it('should render read more label when provided', async () => {
    await renderPostCard({ readMoreLabel: '더 읽기' });

    expect(screen.getByText(/더 읽기/)).toBeInTheDocument();
  });

  it('should not render read more label when not provided', async () => {
    await renderPostCard();

    expect(screen.queryByText(/더 읽기/)).not.toBeInTheDocument();
  });

  it('should link to correct post URL', async () => {
    await renderPostCard();

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/blog/articles/test-post');
  });

  describe('with categoryLabel', () => {
    it('should render category label in Badge when provided', async () => {
      await renderPostCard({ categoryLabel: '아티클' });

      const badge = screen.getByTestId('badge');
      expect(badge).toHaveTextContent('아티클');
      expect(badge).toHaveAttribute('data-variant', 'secondary');
    });
  });

  describe('without categoryLabel', () => {
    it('should not render Badge when category not provided', async () => {
      await renderPostCard();

      expect(screen.queryByTestId('badge')).not.toBeInTheDocument();
    });
  });

  it('should render book icon for reading time', async () => {
    const { container } = await renderPostCard();

    // lucide-react의 BookOpen 아이콘은 SVG로 렌더링됨
    const svgElements = container.querySelectorAll('svg');
    expect(svgElements.length).toBeGreaterThan(0);
  });

  it('should work with English locale', async () => {
    await renderPostCard({ locale: 'en', readMoreLabel: 'Read more' });

    expect(screen.getByText(/Read more/)).toBeInTheDocument();
  });
});
