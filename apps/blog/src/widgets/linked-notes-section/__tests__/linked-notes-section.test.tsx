import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LinkedNotesSection, type LinkedItem } from '../ui/linked-notes-section';

import '@testing-library/jest-dom';

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

const mockLinkedItems: LinkedItem[] = [
  { href: '/garden/sirat', title: '시라트', direction: 'bidirectional' },
  { href: '/garden/luca', title: '루카', direction: 'outgoing' },
];

describe('LinkedNotesSection', () => {
  it('연결된 항목이 없으면 렌더링하지 않는다', () => {
    const { container } = render(
      <LinkedNotesSection linkedItems={[]} linkedNotesLabel="연결된 노트" linkDirectionLabels={linkDirectionLabels} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('제목과 개수를 트리거에 표시한다', () => {
    render(
      <LinkedNotesSection
        linkedItems={mockLinkedItems}
        linkedNotesLabel="연결된 노트"
        linkDirectionLabels={linkDirectionLabels}
      />
    );

    expect(screen.getByRole('button', { name: '연결된 노트 (2)' })).toBeInTheDocument();
  });

  it('기본 상태는 펼쳐져 있고 클릭하면 접힌다', async () => {
    const user = userEvent.setup();

    render(
      <LinkedNotesSection
        linkedItems={mockLinkedItems}
        linkedNotesLabel="연결된 노트"
        linkDirectionLabels={linkDirectionLabels}
      />
    );

    const trigger = screen.getByRole('button', { name: '연결된 노트 (2)' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: '시라트' })).toBeVisible();
    expect(screen.getByRole('link', { name: '루카' })).toBeVisible();
    expect(screen.getByText('서로 참조')).toBeInTheDocument();
    expect(screen.getByText('이 노트가 참조')).toBeInTheDocument();

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('항목이 들고 온 href를 그대로 쓴다', () => {
    render(
      <LinkedNotesSection
        linkedItems={mockLinkedItems}
        linkedNotesLabel="Linked Notes"
        linkDirectionLabels={{
          outgoing: 'This note references',
          incoming: 'References this note',
          bidirectional: 'Mutual reference',
        }}
      />
    );

    expect(screen.getByRole('link', { name: '시라트' })).toHaveAttribute('href', '/garden/sirat');
    expect(screen.getByRole('link', { name: '루카' })).toHaveAttribute('href', '/garden/luca');
  });

  // 위키링크는 가든 안에서만 통하는 주소라, 노트와 글을 잇는 링크는 경로로만 표현된다.
  // 예전처럼 `/garden/${slug}`를 위젯이 만들어 붙이면 블로그 글을 섞을 수 없다.
  it('가든 노트와 블로그 글을 한 목록에 섞을 수 있다', () => {
    render(
      <LinkedNotesSection
        linkedItems={[
          { href: '/garden/oidc-nonce-token-binding', title: 'OIDC nonce', direction: 'outgoing' },
          { href: '/blog/articles/expo-social-login-backend', title: 'Expo 3부', direction: 'incoming' },
        ]}
        linkedNotesLabel="연결된 노트"
        linkDirectionLabels={linkDirectionLabels}
      />
    );

    expect(screen.getByRole('link', { name: 'OIDC nonce' })).toHaveAttribute(
      'href',
      '/garden/oidc-nonce-token-binding'
    );
    expect(screen.getByRole('link', { name: 'Expo 3부' })).toHaveAttribute(
      'href',
      '/blog/articles/expo-social-login-backend'
    );
  });
});
