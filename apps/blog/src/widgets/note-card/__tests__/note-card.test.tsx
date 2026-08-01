import { render, screen } from '@testing-library/react';

import type { NoteMeta } from '@/src/entities/note';

import { NoteCard } from '../ui/note-card';

import '@testing-library/jest-dom';

jest.mock('next-intl/server', () => ({
  getTranslations: jest.fn(async () => (key: string, values?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      'status.seedling': '새싹',
      'status.budding': '성장 중',
      'status.evergreen': '완성',
      linkCount: `링크 ${values?.count}개`,
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
  outgoingHrefs: [],
  readingTime: 3,
};

async function renderNoteCard(note: NoteMeta = baseNote, options: { locale?: string; showStatus?: boolean } = {}) {
  const { locale = 'ko', showStatus } = options;
  const element = await NoteCard({ note, locale, showStatus });
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

      expect(screen.queryByText(/링크/)).not.toBeInTheDocument();
    });

    // 하드코딩된 "N links"는 한국어 페이지에 영문이 새어 나오는 i18n 규칙 위반이었다.
    it('renders link count through the message catalog', async () => {
      await renderNoteCard({ ...baseNote, outgoingLinks: ['a', 'b', 'c'] });

      expect(screen.getByText('링크 3개')).toBeInTheDocument();
      expect(screen.queryByText(/\d+ links/)).not.toBeInTheDocument();
    });
  });

  describe('showStatus', () => {
    it('renders the growth status badge by default', async () => {
      await renderNoteCard({ ...baseNote, status: 'budding' });

      expect(screen.getByText('성장 중')).toBeInTheDocument();
    });

    // 홈 등 가든 밖 표면에서는 관리되지 않는 축을 노출하지 않는다.
    it('omits the growth status badge when disabled', async () => {
      await renderNoteCard({ ...baseNote, status: 'budding' }, { showStatus: false });

      expect(screen.queryByText('성장 중')).not.toBeInTheDocument();
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

  describe('reading time', () => {
    it('renders the reading time before the link count', async () => {
      await renderNoteCard({ ...baseNote, readingTime: 7, outgoingLinks: ['a', 'b'] });

      expect(screen.getByText('7', { exact: false })).toBeInTheDocument();
      expect(screen.getByText('링크 2개')).toBeInTheDocument();
    });
  });

  describe('excerpt', () => {
    it('renders the excerpt when present', async () => {
      await renderNoteCard({ ...baseNote, excerpt: 'A short preview of the note.' });

      expect(screen.getByText('A short preview of the note.')).toBeInTheDocument();
    });

    it('does not render a description paragraph when excerpt is absent', async () => {
      const { container } = await renderNoteCard({ ...baseNote, excerpt: undefined });

      expect(container.querySelector('p')).not.toBeInTheDocument();
    });
  });
});
