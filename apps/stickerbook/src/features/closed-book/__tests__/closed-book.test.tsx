import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { closedHitBox, computeClosedPlacement, computeOpenGeometry } from '@/model/book/geometry';
import { INITIAL_ROTATION } from '@/model/book/rotation';

import { ClosedBook } from '../closed-book';

const viewport = { width: 1440, height: 900 };
const geometry = computeOpenGeometry(viewport, 'spread');

function renderClosedBook(overrides: Partial<React.ComponentProps<typeof ClosedBook>> = {}) {
  const handlers = { onRotate: vi.fn(), onRotateStep: vi.fn(), onOpen: vi.fn() };
  render(
    <ClosedBook
      viewport={viewport}
      geometry={geometry}
      rotation={INITIAL_ROTATION}
      rotationAnimated={false}
      opening={null}
      reducedMotion={false}
      className="extra"
      {...handlers}
      {...overrides}
    />
  );
  return { ...handlers, button: screen.getByRole('button', { name: '책 펼치기' }) };
}

afterEach(() => {
  Reflect.deleteProperty(Element.prototype, 'setPointerCapture');
});

describe('ClosedBook', () => {
  it('should cover the visible book with one button and keep the 3D faces out of the accessibility tree', () => {
    const { button } = renderClosedBook();
    const hitBox = closedHitBox(computeClosedPlacement(viewport, geometry), INITIAL_ROTATION);
    expect(button.style.width).toBe(`${hitBox.width}px`);
    expect(button.style.left).toBe(`${hitBox.x}px`);
    expect(document.querySelector('.closed-book')).toHaveAttribute('aria-hidden', 'true');
    expect(document.querySelector('.closed-stage')).toHaveClass('extra');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('should capture the pointer, rotate while dragging and stop on cancel', () => {
    const capture = vi.fn();
    Object.defineProperty(Element.prototype, 'setPointerCapture', { configurable: true, value: capture });
    const { button, onRotate, onOpen } = renderClosedBook();
    fireEvent.pointerDown(button, { pointerId: 4, button: 0, clientX: 700, clientY: 400 });
    expect(capture).toHaveBeenCalledWith(4);
    fireEvent.pointerMove(button, { pointerId: 4, buttons: 1, clientX: 760, clientY: 400 });
    expect(onRotate).toHaveBeenLastCalledWith({ yaw: INITIAL_ROTATION.yaw + 24, pitch: INITIAL_ROTATION.pitch });
    fireEvent.pointerCancel(button, { pointerId: 4 });
    fireEvent.click(button, { detail: 1 });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('should treat a move without pressed buttons as the missed release and stop rotating', () => {
    const { button, onRotate } = renderClosedBook();
    fireEvent.pointerDown(button, { pointerId: 5, button: 0, clientX: 700, clientY: 400 });
    fireEvent.pointerMove(button, { pointerId: 5, buttons: 1, clientX: 760, clientY: 400 });
    fireEvent.pointerMove(button, { pointerId: 5, buttons: 0, clientX: 780, clientY: 400 });
    expect(onRotate).toHaveBeenLastCalledWith({ yaw: INITIAL_ROTATION.yaw + 32, pitch: INITIAL_ROTATION.pitch });
    fireEvent.pointerMove(button, { pointerId: 5, buttons: 0, clientX: 900, clientY: 400 });
    expect(onRotate).toHaveBeenCalledTimes(2);
  });

  it('should stop rotating when the pointer capture is lost', () => {
    const { button, onRotate, onOpen } = renderClosedBook();
    fireEvent.pointerDown(button, { pointerId: 6, button: 0, clientX: 700, clientY: 400 });
    fireEvent.pointerMove(button, { pointerId: 6, buttons: 1, clientX: 760, clientY: 400 });
    fireEvent.lostPointerCapture(button, { pointerId: 6 });
    fireEvent.pointerMove(button, { pointerId: 6, buttons: 1, clientX: 900, clientY: 400 });
    expect(onRotate).toHaveBeenCalledTimes(1);
    fireEvent.click(button, { detail: 1 });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('should hide the large faces that clearly face away unless a key rotation is animating', () => {
    renderClosedBook();
    expect(document.querySelector('.closed-book__back')).toHaveStyle({ visibility: 'hidden' });
    expect(document.querySelector('.closed-book__cover-front')).not.toHaveStyle({ visibility: 'hidden' });
  });

  it('should leave face visibility to 3D while a key rotation is animating', () => {
    renderClosedBook({ rotation: { yaw: 180, pitch: 0 }, rotationAnimated: true });
    expect(document.querySelector('.closed-book')).toHaveAttribute('data-animated', 'true');
    expect(document.querySelector('.closed-book__cover-front')).not.toHaveStyle({ visibility: 'hidden' });
  });

  it('should ignore secondary buttons', () => {
    const { button, onRotate } = renderClosedBook();
    fireEvent.pointerDown(button, { pointerId: 1, button: 2, clientX: 700, clientY: 400 });
    fireEvent.pointerMove(button, { pointerId: 1, clientX: 900, clientY: 400 });
    expect(onRotate).not.toHaveBeenCalled();
  });

  it('should open with Enter and Space and step with the arrow keys', () => {
    const { button, onOpen, onRotateStep } = renderClosedBook();
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyDown(button, { key: ' ' });
    expect(onOpen).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(button, { key: 'ArrowRight' });
    fireEvent.keyDown(button, { key: 'ArrowLeft' });
    expect(onRotateStep.mock.calls).toEqual([[1], [-1]]);
    fireEvent.keyDown(button, { key: 'ArrowRight', metaKey: true });
    expect(onRotateStep).toHaveBeenCalledTimes(2);
  });

  it('should warm the first spread on hover and focus', () => {
    const { button } = renderClosedBook();
    fireEvent.pointerEnter(button);
    fireEvent.focus(button);
    expect(document.head.querySelector('link[rel="preload"][href="/photos/forest.jpg"]')).not.toBeNull();
  });

  it('should render the inside of the cover and the first page while opening, and ignore the pointer', () => {
    const { button, onRotate } = renderClosedBook({
      opening: { rotation: { yaw: 0, pitch: 0 }, coverAngle: -90, travel: 0.5, handoff: 0, crossfade: false },
    });
    expect(document.querySelector('.closed-stage')).not.toHaveAttribute('style');
    expect(document.querySelector('.closed-book')).toHaveAttribute('data-layout', 'spread');
    expect(document.querySelectorAll('.closed-book__page-chrome')).toHaveLength(2);
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(document.querySelector('.closed-stage')).toHaveAttribute('data-phase', 'opening');
    expect(screen.getByText('사진 · 임시')).toBeInTheDocument();
    expect(document.querySelector('.closed-book__first-page img')).toHaveAttribute('src', '/photos/forest.jpg');
    expect(document.querySelector<HTMLElement>('.closed-book')?.style.getPropertyValue('--cover-angle')).toBe('-90deg');
    fireEvent.pointerDown(button, { pointerId: 1, button: 0, clientX: 700, clientY: 400 });
    fireEvent.pointerMove(button, { pointerId: 1, clientX: 800, clientY: 400 });
    expect(onRotate).not.toHaveBeenCalled();
  });

  it('should fade out over the open book while handing over', () => {
    renderClosedBook({
      opening: { rotation: { yaw: 0, pitch: 0 }, coverAngle: -180, travel: 1, handoff: 0.25, crossfade: false },
    });
    expect(document.querySelector('.closed-stage')).toHaveStyle({ opacity: '0.75' });
  });
});
