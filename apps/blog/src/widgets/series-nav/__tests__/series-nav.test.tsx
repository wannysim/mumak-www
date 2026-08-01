import { render, screen } from '@testing-library/react';

import type { PostMeta, SeriesContext } from '@/src/entities/post';

import { SeriesNav } from '../ui/series-nav';

import '@testing-library/jest-dom';

jest.mock('next-intl/server', () => ({
  getTranslations: jest.fn(async () => (key: string, values?: Record<string, number>) => {
    if (key === 'seriesProgress') return `${values?.total}편 중 ${values?.current}편`;
    return key;
  }),
}));

jest.mock('@/src/shared/config/i18n', () => ({
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

function part(n: number): PostMeta {
  return {
    slug: `part-${n}`,
    title: `${n}부 제목`,
    date: `2026-01-0${n}`,
    description: '',
    category: 'articles',
    readingTime: 5,
    series: 'Expo 소셜 로그인',
    part: n,
  };
}

const parts = [part(1), part(2), part(3)];

function contextFor(index: number): SeriesContext {
  const current = parts[index];
  if (!current) throw new Error('fixture missing');
  return { parts, current, previous: parts[index - 1], next: parts[index + 1] };
}

async function renderSeriesNav(index = 1) {
  return render(await SeriesNav({ series: contextFor(index) }));
}

describe('SeriesNav', () => {
  it('시리즈 이름으로 이름 붙은 navigation landmark다', async () => {
    await renderSeriesNav();

    expect(screen.getByRole('navigation', { name: 'Expo 소셜 로그인' })).toBeInTheDocument();
  });

  it('전체 편 수와 현재 위치를 함께 보여준다', async () => {
    await renderSeriesNav();

    expect(screen.getByText('3편 중 2편')).toBeInTheDocument();
  });

  it('다른 편은 링크로, 현재 편은 링크가 아니라 aria-current로 표시한다', async () => {
    await renderSeriesNav();

    expect(screen.getByRole('link', { name: '1부 제목' })).toHaveAttribute('href', '/blog/articles/part-1');
    expect(screen.getByRole('link', { name: '3부 제목' })).toHaveAttribute('href', '/blog/articles/part-3');
    expect(screen.queryByRole('link', { name: '2부 제목' })).not.toBeInTheDocument();
    expect(screen.getByText('2부 제목')).toHaveAttribute('aria-current', 'page');
  });

  it('본문 목차와 섞이지 않도록 라벨을 heading으로 두지 않는다', async () => {
    const { container } = await renderSeriesNav();

    expect(container.querySelectorAll('h1, h2, h3, h4, h5, h6')).toHaveLength(0);
  });

  it('편 번호는 목록 순서가 아니라 frontmatter의 part를 쓴다', async () => {
    const sparse: SeriesContext = { parts: [part(1), part(4)], current: part(1), next: part(4) };
    render(await SeriesNav({ series: sparse }));

    expect(screen.getByText('4')).toBeInTheDocument();
  });
});
