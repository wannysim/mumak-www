import { render, screen } from '@testing-library/react';

import type { NoteMeta } from '@/src/entities/note';

import { GardenHighlights } from '../ui/garden-highlights';

import '@testing-library/jest-dom';

jest.mock('next-intl/server', () => ({
  getTranslations: jest.fn(async () => (key: string, values?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      gardenTitle: '최신 노트',
      gardenCta: `노트 ${values?.count}개 전체 보기`,
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

// NoteCard는 async 서버 컴포넌트라 자식으로 두면 RTL이 트리를 못 그린다. 카드 내부는
// note-card 자체 테스트가 지키고, 여기서는 이 블록이 NoteCard에 넘기는 계약만 검증한다.
const mockNoteCard = jest.fn();

jest.mock('@/src/widgets/note-card', () => ({
  NoteCard: (props: { note: NoteMeta; locale: string; showStatus?: boolean }) => {
    mockNoteCard(props);
    return (
      <article data-slot="content-card" data-show-status={String(props.showStatus)}>
        <a href={`/garden/${props.note.slug}`}>{props.note.title}</a>
      </article>
    );
  },
}));

function buildNote(overrides: Partial<NoteMeta> = {}): NoteMeta {
  return {
    slug: 'a-note',
    title: 'A Note',
    category: 'resources',
    created: '2026-01-01',
    status: 'seedling',
    outgoingLinks: [],
    readingTime: 1,
    ...overrides,
  };
}

describe('GardenHighlights', () => {
  beforeEach(() => {
    mockNoteCard.mockClear();
  });

  it('renders a heading, note links and the full-garden CTA with the real total', async () => {
    const notes = [buildNote({ slug: 'first', title: 'First Note' }), buildNote({ slug: 'second', title: 'Second' })];

    render(await GardenHighlights({ notes, locale: 'ko', totalCount: 97 }));

    expect(screen.getByRole('heading', { level: 2, name: '최신 노트' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'First Note' })).toHaveAttribute('href', '/garden/first');
    expect(screen.getByRole('link', { name: '노트 97개 전체 보기' })).toHaveAttribute('href', '/garden');
  });

  // 홈에서 블로그 블록과 같은 카드 shell을 써야 두 섹션이 대등하게 읽힌다.
  it('renders one shared content card per note', async () => {
    const notes = [buildNote({ slug: 'a' }), buildNote({ slug: 'b' }), buildNote({ slug: 'c' })];

    render(await GardenHighlights({ notes, locale: 'ko', totalCount: 97 }));

    expect(document.querySelectorAll('[data-slot="content-card"]')).toHaveLength(3);
    expect(mockNoteCard).toHaveBeenCalledTimes(3);
  });

  // 상태 축은 실제로 관리되지 않아 홈에서 광고하지 않기로 했다.
  it('turns the growth status badge off for every card', async () => {
    const notes = [buildNote({ slug: 'a' }), buildNote({ slug: 'b' })];

    render(await GardenHighlights({ notes, locale: 'ko', totalCount: 2 }));

    for (const call of mockNoteCard.mock.calls) {
      expect(call[0]).toMatchObject({ showStatus: false });
    }
  });

  it('passes the locale through to each card', async () => {
    render(await GardenHighlights({ notes: [buildNote()], locale: 'en', totalCount: 1 }));

    expect(mockNoteCard).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en' }));
  });

  it('renders nothing when the garden is empty', async () => {
    const { container } = render(await GardenHighlights({ notes: [], locale: 'ko', totalCount: 0 }));

    expect(container).toBeEmptyDOMElement();
  });
});
