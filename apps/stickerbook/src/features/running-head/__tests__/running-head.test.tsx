import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RunningHead } from '../running-head';

describe('RunningHead', () => {
  it('should show the name, the line, the status and the folio on wide screens', () => {
    render(
      <RunningHead
        parts={{ line: true, status: true }}
        folio="03–04/08"
        folioReading="03–04쪽, 전체 8쪽"
        className="extra"
      />
    );
    const banner = screen.getByRole('banner');
    expect(banner).toHaveClass('extra', 'whitespace-nowrap');
    expect(banner).toHaveTextContent('심완, 사진을 찍고 화면을 만든다');
    expect(screen.getByText('지금 다음 호에 실을 사진을 고르는 중')).toHaveClass('truncate');
    expect(screen.getByText('03–04/08')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('03–04쪽, 전체 8쪽')).toHaveClass('sr-only');
  });

  it('should drop the status line on narrow spread screens', () => {
    render(<RunningHead parts={{ line: true, status: false }} folio="01–02/08" folioReading={null} />);
    const banner = screen.getByRole('banner');
    expect(banner).toHaveTextContent('사진을 찍고 화면을 만든다');
    expect(banner).not.toHaveTextContent('지금 다음 호에');
  });

  it('should keep only the name and the folio on a phone', () => {
    render(<RunningHead parts={{ line: false, status: false }} folio="앞표지" folioReading={null} />);
    const banner = screen.getByRole('banner');
    expect(banner).not.toHaveTextContent('사진을 찍고 화면을 만든다');
    expect(banner).not.toHaveTextContent('지금 다음 호에');
    expect(screen.getByText('앞표지')).not.toHaveAttribute('aria-hidden');
  });
});
