import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RunningHead } from '../running-head';

describe('RunningHead', () => {
  it('should show the name, the line, the status and the folio on wide screens', () => {
    render(
      <RunningHead
        parts={{ line: true, status: true }}
        folio="03–04/08"
        folioReading="03–04쪽, 전체 8쪽"
        nameAction={null}
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
    render(
      <RunningHead parts={{ line: true, status: false }} folio="01–02/08" folioReading={null} nameAction={null} />
    );
    const banner = screen.getByRole('banner');
    expect(banner).toHaveTextContent('사진을 찍고 화면을 만든다');
    expect(banner).not.toHaveTextContent('지금 다음 호에');
  });

  it('should keep only the name and the folio on a phone', () => {
    render(<RunningHead parts={{ line: false, status: false }} folio="08/08" folioReading={null} nameAction={null} />);
    const banner = screen.getByRole('banner');
    expect(banner).not.toHaveTextContent('사진을 찍고 화면을 만든다');
    expect(banner).not.toHaveTextContent('지금 다음 호에');
    expect(screen.getByText('08/08')).not.toHaveAttribute('aria-hidden');
  });

  it('should let pointers through on the closed book, where the name is plain text and there is no folio', () => {
    render(<RunningHead parts={{ line: true, status: true }} folio={null} folioReading={null} nameAction={null} />);
    const banner = screen.getByRole('banner');
    expect(banner).toHaveClass('pointer-events-none');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    // 잡지 표지에는 쪽 번호가 없다. 상태 줄은 그대로 남는다.
    expect(banner.querySelector('[data-folio]')).toBeNull();
    expect(banner).toHaveTextContent('지금 다음 호에');
  });

  it('should make the name a button that closes the open book, looking the same with a spoken hint', () => {
    const onPress = vi.fn();
    const { rerender } = render(
      <RunningHead
        parts={{ line: true, status: false }}
        folio="03–04/08"
        folioReading={null}
        nameAction={{ disabled: false, onPress }}
      />
    );
    expect(screen.getByRole('banner')).not.toHaveClass('pointer-events-none');
    const name = screen.getByRole('button', { name: '심완, 사진을 찍고 화면을 만든다, 눌러서 앞표지로 덮기' });
    expect(name).toHaveAttribute('type', 'button');
    // 칸 전체가 아니라 글자 폭만 차지한다(빈 머리 공간을 눌러도 덮이지 않게). 실제 폭은 E2E가 잰다.
    expect(name).toHaveClass('justify-self-start', 'max-w-full');
    expect(name.querySelector('.truncate')).toHaveTextContent('심완, 사진을 찍고 화면을 만든다');
    fireEvent.click(name);
    expect(onPress).toHaveBeenCalledTimes(1);
    rerender(
      <RunningHead
        parts={{ line: true, status: false }}
        folio="03–04/08"
        folioReading={null}
        nameAction={{ disabled: true, onPress }}
      />
    );
    expect(name).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(name);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
