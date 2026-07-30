import { render, screen } from '@testing-library/react';

import type { NoteMeta } from '@/src/entities/note';

import { GardenHighlights } from '../ui/garden-highlights';

import '@testing-library/jest-dom';

jest.mock('next-intl/server', () => ({
  getTranslations: jest.fn(async () => (key: string, values?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      gardenTitle: '가든에서',
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

jest.mock('@/src/shared/lib/date', () => ({
  formatDateForLocale: (date: string) => ({ text: `formatted:${date}`, dateTime: date }),
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
  it('renders a heading, note links and the full-garden CTA with the real total', async () => {
    const notes = [buildNote({ slug: 'first', title: 'First Note' }), buildNote({ slug: 'second', title: 'Second' })];

    render(await GardenHighlights({ notes, locale: 'ko', totalCount: 103 }));

    expect(screen.getByRole('heading', { name: '가든에서' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /First Note/ })).toHaveAttribute('href', '/garden/first');
    expect(screen.getByRole('link', { name: '노트 103개 전체 보기' })).toHaveAttribute('href', '/garden');
  });

  // 상태 축은 실제로 관리되지 않아 홈에서 광고하지 않기로 했다. 카드에 다시 새어 나오면
  // 없는 편집 관행을 약속하는 셈이 된다.
  it('does not surface growth status on the home surface', async () => {
    render(await GardenHighlights({ notes: [buildNote({ status: 'seedling' })], locale: 'ko', totalCount: 1 }));

    expect(screen.queryByText(/seedling|씨앗|새싹/)).not.toBeInTheDocument();
  });

  it('prefers the updated date over the created date', async () => {
    const notes = [buildNote({ created: '2026-01-01', updated: '2026-05-05' })];

    render(await GardenHighlights({ notes, locale: 'ko', totalCount: 1 }));

    expect(screen.getByText('formatted:2026-05-05')).toBeInTheDocument();
  });

  it('renders nothing when the garden is empty', async () => {
    const { container } = render(await GardenHighlights({ notes: [], locale: 'ko', totalCount: 0 }));

    expect(container).toBeEmptyDOMElement();
  });
});
