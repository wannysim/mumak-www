import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import type { NoteMeta } from '@/src/entities/note';
import { NoteCard } from '../ui/note-card';

jest.mock('next-intl/server', () => ({
  getTranslations: jest.fn(async () => (key: string) => {
    const translations: Record<string, string> = {
      'status.seedling': '새싹',
      'status.budding': '성장 중',
      'status.evergreen': '완성',
    };
    return translations[key] ?? key;
  }),
}));

jest.mock('@/src/shared/config/i18n', () => ({
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

jest.mock('@/src/shared/lib/date', () => ({
  formatDateForLocale: (date: string) => ({
    text: '2024년 1월 1일',
    dateTime: date,
  }),
}));

jest.mock('@mumak/ui/components/badge', () => ({
  Badge: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}));

jest.mock('@/src/widgets/post-card/ui/post-tags', () => ({
  PostTags: ({ tags, basePath }: { tags: string[]; basePath: string }) => (
    <div data-testid="post-tags" data-base-path={basePath}>
      {tags.join(',')}
    </div>
  ),
}));

const baseNote: NoteMeta = {
  category: 'garden',
  slug: 'test-note',
  title: 'Test Note Title',
  created: '2024-01-01',
  status: 'seedling',
  outgoingLinks: [],
};

async function renderNoteCard(note: NoteMeta = baseNote, locale = 'ko') {
  const element = await NoteCard({ note, locale });
  return render(element);
}

describe('NoteCard', () => {
  it('should render note title', async () => {
    await renderNoteCard();

    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Test Note Title');
  });

  it('should link to garden detail page using slug', async () => {
    await renderNoteCard();

    expect(screen.getByRole('link')).toHaveAttribute('href', '/garden/test-note');
  });

  it('should render formatted date', async () => {
    await renderNoteCard();

    expect(screen.getByText('2024년 1월 1일')).toBeInTheDocument();
  });

  describe('status badge', () => {
    it.each([
      ['seedling', 'outline', '새싹'],
      ['budding', 'secondary', '성장 중'],
      ['evergreen', 'default', '완성'],
    ] as const)('renders %s status with %s variant', async (status, variant, label) => {
      await renderNoteCard({ ...baseNote, status });

      const badge = screen.getByTestId('badge');
      expect(badge).toHaveAttribute('data-variant', variant);
      expect(badge).toHaveTextContent(label);
    });
  });

  describe('updated date', () => {
    it('uses updated when present', async () => {
      const { container } = await renderNoteCard({ ...baseNote, updated: '2024-02-15' });

      expect(container.querySelector('time')).toHaveAttribute('datetime', '2024-02-15');
    });

    it('falls back to created when updated is absent', async () => {
      const { container } = await renderNoteCard({ ...baseNote, updated: undefined });

      expect(container.querySelector('time')).toHaveAttribute('datetime', '2024-01-01');
    });
  });

  describe('outgoingLinks', () => {
    it('does not render link count when empty', async () => {
      await renderNoteCard({ ...baseNote, outgoingLinks: [] });

      expect(screen.queryByText(/links/)).not.toBeInTheDocument();
    });

    it('renders link count when there are outgoing links', async () => {
      await renderNoteCard({ ...baseNote, outgoingLinks: ['a', 'b', 'c'] });

      expect(screen.getByText('3 links')).toBeInTheDocument();
    });
  });

  describe('tags', () => {
    it('does not render PostTags when no tags', async () => {
      await renderNoteCard({ ...baseNote, tags: undefined });

      expect(screen.queryByTestId('post-tags')).not.toBeInTheDocument();
    });

    it('does not render PostTags when tags array is empty', async () => {
      await renderNoteCard({ ...baseNote, tags: [] });

      expect(screen.queryByTestId('post-tags')).not.toBeInTheDocument();
    });

    it('renders PostTags with garden base path when tags exist', async () => {
      await renderNoteCard({ ...baseNote, tags: ['react', 'testing'] });

      const tags = screen.getByTestId('post-tags');
      expect(tags).toHaveAttribute('data-base-path', '/garden/tags');
      expect(tags).toHaveTextContent('react,testing');
    });
  });
});
