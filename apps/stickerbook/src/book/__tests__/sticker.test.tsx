import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Sticker } from '@/book/sticker';

function gesture(
  type: 'pointerDown' | 'pointerMove' | 'pointerUp' | 'pointerCancel' | 'lostPointerCapture',
  x: number,
  time: number,
  id = 1,
  isPrimary = true
) {
  const target = screen.getByRole('button');
  const event = createEvent[type](target, {
    pointerId: id,
    isPrimary,
    button: 0,
    clientX: x,
    clientY: 0,
    bubbles: true,
  });
  Object.defineProperty(event, 'timeStamp', { value: time + 1000 });
  fireEvent(target, event);
}
describe('peeling input', () => {
  it.each([
    [400, 'clean'],
    [30, 'residue'],
    [8, 'residue'],
  ] as const)('peels after %i ms as %s', (duration, result) => {
    const change = vi.fn();
    render(<Sticker state="attached" onChange={change} reduced={false} />);
    gesture('pointerDown', 0, 0);
    gesture('pointerMove', 100, duration);
    gesture('pointerUp', 100, duration + 1);
    expect(change).toHaveBeenLastCalledWith(result);
    fireEvent.click(screen.getByRole('button'), { detail: 1 });
    expect(change).toHaveBeenCalledTimes(1);
  });
  it('cancellation and lost capture reset without removing; keyboard still works', () => {
    const change = vi.fn();
    render(<Sticker state="attached" onChange={change} reduced />);
    gesture('pointerDown', 0, 0);
    gesture('pointerMove', 100, 100);
    gesture('pointerCancel', 100, 110);
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button'));
    expect(change).toHaveBeenCalledWith('clean');
    change.mockClear();
    gesture('pointerDown', 0, 200);
    gesture('lostPointerCapture', 100, 220);
    expect(change).not.toHaveBeenCalled();
  });
  it('ignores secondary pointers and keeps a partial peel attached', () => {
    const change = vi.fn();
    render(<Sticker state="attached" onChange={change} reduced={false} />);
    gesture('pointerDown', 0, 0, 2, false);
    gesture('pointerMove', 50, 20);
    gesture('pointerUp', 50, 30);
    expect(change).not.toHaveBeenCalled();
    gesture('pointerDown', 0, 40);
    gesture('pointerDown', 50, 50, 2);
    gesture('pointerMove', 150, 70, 2);
    gesture('pointerUp', 150, 80, 2);
    gesture('pointerMove', 10, 90);
    gesture('pointerMove', 11, 92);
    gesture('pointerUp', 11, 100);
    expect(change).toHaveBeenLastCalledWith('attached');
  });
  it('does not start another peel on a removed sticker', () => {
    const change = vi.fn();
    render(<Sticker state="residue" onChange={change} reduced={false} />);
    gesture('pointerDown', 0, 0);
    gesture('pointerMove', 100, 100);
    gesture('pointerUp', 100, 120);
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button'));
    expect(change).toHaveBeenCalledWith('attached');
  });
});
