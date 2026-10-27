import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TurningPage } from '@/book/turning-page';
import { computeLayout } from '@/lib/interaction';

const layout = computeLayout({ left: 0, top: 0, width: 1000, height: 650 });
const turn = { from: 0, to: 2, direction: 1 as const, progress: 0.5, grip: { y: 0.9, pullY: 0 } };
describe('native HTML sheet faces', () => {
  it('turns page 2 onto page 3 while page 4 waits underneath', () => {
    const { container } = render(<TurningPage turn={turn} layout={layout} stickers={{ 3: 'residue' }} />);
    expect(container.querySelector('.book-pages')).toHaveTextContent('The quiet outside');
    expect(container.querySelector('.book-pages')).toHaveTextContent('Far from here');
    expect(container.querySelector('[data-face="front"]')).toHaveTextContent('A place to pause');
    expect(container.querySelector('[data-face="back"]')).toHaveTextContent('Into the green');
    expect(container.querySelector('[data-face="front"] [data-sticker-state="residue"]')).not.toBeNull();
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.firstChild).toHaveAttribute('inert');
  });
  it('reverses the same sheet: page 3 front, page 2 back, page 1 underneath', () => {
    const { container } = render(
      <TurningPage turn={{ ...turn, from: 2, to: 0, direction: -1 }} layout={layout} stickers={{}} />
    );
    expect(container.querySelector('.book-pages')).toHaveTextContent('The quiet outside');
    expect(container.querySelector('.book-pages')).toHaveTextContent('Far from here');
    expect(container.querySelector('[data-face="front"]')).toHaveTextContent('Into the green');
    expect(container.querySelector('[data-face="back"]')).toHaveTextContent('A place to pause');
  });
  it('does not replace the resting surface when merely held', () => {
    const { container, rerender } = render(
      <TurningPage turn={{ ...turn, progress: 0 }} layout={layout} stickers={{}} />
    );
    expect(container.firstChild).toHaveStyle({ visibility: 'hidden' });
    rerender(<TurningPage turn={{ ...turn, progress: 0.1 }} layout={layout} stickers={{}} />);
    expect(container.firstChild).toHaveStyle({ visibility: 'visible' });
  });
});
