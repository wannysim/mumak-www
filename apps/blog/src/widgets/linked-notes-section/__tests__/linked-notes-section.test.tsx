import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { LinkedNote } from '@/src/entities/note';
import { LinkedNotesSection } from '../ui/linked-notes-section';

jest.mock('@/src/shared/config/i18n', () => ({
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const linkDirectionLabels = {
  outgoing: '이 노트가 참조',
  incoming: '이 노트를 참조',
  bidirectional: '서로 참조',
} as const;

const mockLinkedNotes: LinkedNote[] = [
  {
    category: 'garden',
    slug: 'sirat',
    title: '시라트',
    created: '2026-03-10',
    status: 'seedling',
    outgoingLinks: ['movie'],
    direction: 'bidirectional',
  },
  {
    category: 'garden',
    slug: 'luca',
    title: '루카',
    created: '2026-03-10',
    status: 'seedling',
    outgoingLinks: ['movie'],
    direction: 'outgoing',
  },
];

describe('LinkedNotesSection', () => {
  it('연결된 노트가 없으면 렌더링하지 않는다', () => {
    const { container } = render(
      <LinkedNotesSection linkedNotes={[]} linkedNotesLabel="연결된 노트" linkDirectionLabels={linkDirectionLabels} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('제목과 개수를 트리거에 표시한다', () => {
    render(
      <LinkedNotesSection
        linkedNotes={mockLinkedNotes}
        linkedNotesLabel="연결된 노트"
        linkDirectionLabels={linkDirectionLabels}
      />
    );

    expect(screen.getByRole('button', { name: '연결된 노트 (2)' })).toBeInTheDocument();
  });

  it('기본 상태는 접혀 있고 클릭하면 목록이 펼쳐진다', async () => {
    const user = userEvent.setup();

    render(
      <LinkedNotesSection
        linkedNotes={mockLinkedNotes}
        linkedNotesLabel="연결된 노트"
        linkDirectionLabels={linkDirectionLabels}
      />
    );

    expect(screen.queryByRole('link', { name: '시라트' })).not.toBeInTheDocument();

    const trigger = screen.getByRole('button', { name: '연결된 노트 (2)' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: '시라트' })).toBeVisible();
    expect(screen.getByRole('link', { name: '루카' })).toBeVisible();
    expect(screen.getByText('서로 참조')).toBeInTheDocument();
    expect(screen.getByText('이 노트가 참조')).toBeInTheDocument();
  });

  it('펼친 후 링크 경로를 유지한다', async () => {
    const user = userEvent.setup();

    render(
      <LinkedNotesSection
        linkedNotes={mockLinkedNotes}
        linkedNotesLabel="Linked Notes"
        linkDirectionLabels={{
          outgoing: 'This note references',
          incoming: 'References this note',
          bidirectional: 'Mutual reference',
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Linked Notes (2)' }));

    expect(screen.getByRole('link', { name: '시라트' })).toHaveAttribute('href', '/garden/sirat');
    expect(screen.getByRole('link', { name: '루카' })).toHaveAttribute('href', '/garden/luca');
  });
});
