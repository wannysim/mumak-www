import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BookPage } from '../book-page';

describe('BookPage', () => {
  it('should show only the photo on a photo page', () => {
    const { container } = render(<BookPage page={3} layout="spread" />);
    const image = screen.getByRole('img', { name: '산 아래 호수와 물 위 오두막(임시 샘플 사진)' });
    expect(image).toHaveAttribute('src', '/photos/lake.jpg');
    expect(image).toHaveAttribute('draggable', 'false');
    expect(container.firstElementChild).toHaveAttribute('data-side', 'left');
  });

  it('should show the opening lines and the colophon placeholder as text', () => {
    render(<BookPage page={1} layout="single" className="extra" />);
    expect(screen.getByText('사진 · 임시').closest('.book-page')).toHaveClass('extra');
    render(<BookPage page={8} layout="single" />);
    expect(screen.getByText('판권면 · 임시').closest('.book-page')).toHaveAttribute('data-side', 'right');
  });
});
