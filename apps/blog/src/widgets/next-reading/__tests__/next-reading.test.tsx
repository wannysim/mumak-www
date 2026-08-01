import { render, screen } from '@testing-library/react';

import type { PostMeta } from '@/src/entities/post';

import { NextReading } from '../ui/next-reading';

import '@testing-library/jest-dom';

jest.mock('next-intl/server', () => ({
  getTranslations: jest.fn(async () => (key: string, values?: Record<string, string>) => {
    const translations: Record<string, string> = {
      nextReading: '다음 읽을거리',
      readingTimeUnit: '분',
      moreInCategory: `${values?.category ?? ''} 더 보기`,
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

const posts: PostMeta[] = [
  {
    slug: 'first',
    title: '첫 번째 글',
    date: '2026-01-02',
    description: '설명 1',
    category: 'articles',
    tags: ['react'],
    readingTime: 7,
    outgoingHrefs: [],
  },
  {
    slug: 'second',
    title: '두 번째 글',
    date: '2026-01-01',
    description: '설명 2',
    category: 'essay',
    readingTime: 3,
    outgoingHrefs: [],
  },
];

async function renderNextReading(props: Partial<Parameters<typeof NextReading>[0]> = {}) {
  const element = await NextReading({ posts, locale: 'ko', category: 'articles', ...props });
  return render(element);
}

describe('NextReading', () => {
  it('제안 글을 각자의 상세 경로로 링크한다', async () => {
    await renderNextReading();

    expect(screen.getByRole('link', { name: /첫 번째 글/ })).toHaveAttribute('href', '/blog/articles/first');
    expect(screen.getByRole('link', { name: /두 번째 글/ })).toHaveAttribute('href', '/blog/essay/second');
  });

  it('섹션 제목은 h2다 (h1은 글 제목이 쓴다)', async () => {
    await renderNextReading();

    expect(screen.getByRole('heading', { level: 2, name: '다음 읽을거리' })).toBeInTheDocument();
  });

  it('제목으로 이름 붙은 navigation landmark로 감싼다', async () => {
    await renderNextReading();

    expect(screen.getByRole('navigation', { name: '다음 읽을거리' })).toBeInTheDocument();
  });

  it('본문 article과 landmark가 겹치지 않도록 카드(article)를 쓰지 않는다', async () => {
    const { container } = await renderNextReading();

    expect(container.querySelectorAll('article')).toHaveLength(0);
  });

  it('행마다 카테고리와 읽기 시간을 함께 보여준다', async () => {
    await renderNextReading();

    expect(screen.getByText('아티클 · 7분')).toBeInTheDocument();
    expect(screen.getByText('에세이 · 3분')).toBeInTheDocument();
  });

  it('다 읽은 뒤 붙는 블록이라 description은 싣지 않는다', async () => {
    await renderNextReading();

    expect(screen.queryByText('설명 1')).not.toBeInTheDocument();
  });

  it('현재 카테고리 목록으로 가는 보조 링크를 남긴다', async () => {
    await renderNextReading();

    expect(screen.getByRole('link', { name: /아티클 더 보기/ })).toHaveAttribute('href', '/blog/articles');
  });

  it('영어 로케일에서는 영어 카테고리 라벨을 쓴다', async () => {
    await renderNextReading({ locale: 'en' });

    expect(screen.getByText('Articles · 7분')).toBeInTheDocument();
    expect(screen.getByText('Essay · 3분')).toBeInTheDocument();
  });

  it('제안할 글이 없으면 아무것도 렌더하지 않는다', async () => {
    const element = await NextReading({ posts: [], locale: 'ko', category: 'articles' });

    expect(element).toBeNull();
  });
});
