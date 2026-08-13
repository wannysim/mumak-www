import { render, screen } from '@testing-library/react';

import type { ContentHeading } from '@/src/shared/lib/content';

import { PostToc, shouldShowToc, TOC_MIN_READING_TIME } from '../ui/post-toc';

import '@testing-library/jest-dom';

function heading(text: string, level = 2, index = 0): ContentHeading {
  return { index, level, text, anchor: text };
}

const headings = [heading('첫 섹션', 2, 0), heading('둘째 섹션', 2, 10), heading('하위 항목', 3, 20)];

describe('shouldShowToc', () => {
  it(`읽기 시간이 ${TOC_MIN_READING_TIME}분 미만이면 띄우지 않는다`, () => {
    expect(shouldShowToc(headings, TOC_MIN_READING_TIME - 1)).toBe(false);
  });

  // readingTime만으로 걸면 헤딩이 없는 긴 에세이에 빈 목차가 뜬다.
  it('헤딩이 3개 미만이면 읽기 시간과 무관하게 띄우지 않는다', () => {
    expect(shouldShowToc(headings.slice(0, 2), 30)).toBe(false);
  });

  it('둘 다 충족하면 띄운다', () => {
    expect(shouldShowToc(headings, TOC_MIN_READING_TIME)).toBe(true);
  });
});

describe('PostToc', () => {
  it('조건을 못 채우면 아무것도 렌더하지 않는다', () => {
    expect(PostToc({ headings, readingTime: 1, label: '목차' })).toBeNull();
  });

  it('제목으로 이름 붙은 navigation landmark다', () => {
    render(<PostToc headings={headings} readingTime={12} label="목차" />);

    expect(screen.getByRole('navigation', { name: '목차' })).toBeInTheDocument();
  });

  it('각 헤딩을 앵커 링크로 건다', () => {
    render(<PostToc headings={headings} readingTime={12} label="목차" />);

    expect(screen.getByRole('link', { name: '첫 섹션' })).toHaveAttribute('href', '#첫 섹션');
    expect(screen.getByRole('link', { name: '하위 항목' })).toHaveAttribute('href', '#하위 항목');
  });

  it('h3 이하는 들여쓴다', () => {
    render(<PostToc headings={headings} readingTime={12} label="목차" />);

    expect(screen.getByRole('link', { name: '첫 섹션' })).not.toHaveClass('pl-6');
    expect(screen.getByRole('link', { name: '하위 항목' })).toHaveClass('pl-6');
  });

  // 본문 섹션 목차와 층이 겹치지 않게 라벨은 heading이 아니다.
  it('라벨을 heading으로 두지 않는다', () => {
    const { container } = render(<PostToc headings={headings} readingTime={12} label="목차" />);

    expect(container.querySelectorAll('h1, h2, h3, h4, h5, h6')).toHaveLength(0);
  });

  it('xl 미만에서는 감춘다', () => {
    render(<PostToc headings={headings} readingTime={12} label="목차" />);

    expect(screen.getByRole('navigation', { name: '목차' })).toHaveClass('hidden', 'xl:block');
  });
});
