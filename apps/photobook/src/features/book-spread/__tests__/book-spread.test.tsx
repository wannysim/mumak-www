import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BookEvent, BookScene } from '@/model/book/book-state';
import { beginCoverDrag, coverLens } from '@/model/book/closing';
import type { OpenGeometry } from '@/model/book/geometry';
import { computeOpenGeometry, turnFrame } from '@/model/book/geometry';
import { beginClickTurn, beginDragTurn } from '@/model/book/turn-session';
import { nextView } from '@/model/fold';

import { BookSpread } from '../book-spread';

type OpenScene = Extract<BookScene, { phase: 'open' | 'turning' | 'closing' }>;

const geometry = computeOpenGeometry({ width: 1440, height: 900 }, 'spread');
const openScene: Extract<BookScene, { phase: 'open' }> = { phase: 'open', view: { layout: 'spread', spread: 1 } };

function renderSpread(
  scene: OpenScene = openScene,
  reducedMotion = false,
  at: OpenGeometry = geometry,
  takeFocus = true
) {
  const onBookEvent = vi.fn<(event: BookEvent) => void>();
  render(
    <BookSpread
      scene={scene}
      geometry={at}
      pageCount={8}
      reducedMotion={reducedMotion}
      takeFocus={takeFocus}
      onBookEvent={onBookEvent}
      className="extra"
      style={{ opacity: 0.5 }}
    />
  );
  return { onBookEvent, region: screen.getByRole('region', { name: '펼친 책' }) };
}

function turningScene(motion: 'click' | 'drag'): OpenScene {
  const view = openScene.view;
  const move = nextView(view, 8);
  if (move === null) {
    throw new Error('move expected');
  }
  const setup = { frame: turnFrame(geometry, 'forward'), direction: 'forward' as const, page: geometry.page };
  const session =
    motion === 'click' ? beginClickTurn(setup, null) : beginDragTurn(setup, { x: 1000, y: 300 }, { x: 990, y: 300 }, 0);
  return { phase: 'turning', view, move, session };
}

function eventTypes(onBookEvent: ReturnType<typeof renderSpread>['onBookEvent']): string[] {
  return onBookEvent.mock.calls.map(([event]) => event.type);
}

afterEach(() => {
  Reflect.deleteProperty(Element.prototype, 'setPointerCapture');
});

describe('BookSpread', () => {
  it('should take focus when it appears and keep the given style', () => {
    const { region } = renderSpread();
    expect(region).toHaveFocus();
    expect(region).toHaveClass('book-stage', 'extra');
    expect(region).toHaveStyle({ opacity: '0.5' });
    expect(region.style.getPropertyValue('--turn-gutter')).toBe(`${geometry.book.x}px`);
  });

  it('should leave focus on the page when asked not to take it, and still turn with the arrows from there', () => {
    // 문서 단위 키로 펼쳤다(포커스가 body). 책에 포커스 표시가 생기지 않게 옮기지 않는다.
    const { region, onBookEvent } = renderSpread(openScene, false, geometry, false);
    expect(region).not.toHaveFocus();
    expect(document.activeElement).toBe(document.body);
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(onBookEvent).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'turn-click', direction: 'forward' }));
    // 입력칸의 화살표는 글자 커서 몫이다.
    const input = document.createElement('input');
    document.body.append(input);
    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    input.remove();
    expect(onBookEvent).toHaveBeenCalledTimes(1);
  });

  it('should send the click height for pointer clicks and no point for keyboard activation', () => {
    const { onBookEvent } = renderSpread();
    const next = screen.getByRole('button', { name: '다음 쪽' });
    fireEvent.click(next, { detail: 1, clientX: 1300, clientY: 212 });
    expect(onBookEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'turn-click', direction: 'forward', press: { x: 1300 - 213, y: 100 } })
    );
    fireEvent.click(screen.getByRole('button', { name: '이전 쪽' }));
    expect(onBookEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'turn-click', direction: 'backward', press: null, reducedMotion: false })
    );
  });

  it('should capture the pointer on the pressed element and report the drag in book coordinates', () => {
    const capture = vi.fn();
    Object.defineProperty(Element.prototype, 'setPointerCapture', { configurable: true, value: capture });
    const { onBookEvent } = renderSpread();
    const next = screen.getByRole('button', { name: '다음 쪽' });
    const notPrevented = fireEvent.pointerDown(next, {
      pointerId: 3,
      pointerType: 'mouse',
      button: 0,
      clientX: 1300,
      clientY: 500,
    });
    expect(notPrevented).toBe(false);
    expect(capture).toHaveBeenCalledWith(3);
    expect(capture.mock.contexts[0]).toBe(next);
    fireEvent.pointerMove(next, { pointerId: 3, buttons: 1, clientX: 1290, clientY: 500 });
    expect(onBookEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'turn-drag-start', direction: 'forward', origin: { x: 1087, y: 388 } })
    );
    fireEvent.pointerMove(next, { pointerId: 3, buttons: 1, clientX: 1000, clientY: 520 });
    expect(onBookEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'turn-drag-move', point: { x: 787, y: 408 } })
    );
    fireEvent.pointerCancel(next, { pointerId: 3 });
    expect(onBookEvent).toHaveBeenLastCalledWith({ type: 'turn-drag-cancel', geometry, reducedMotion: false });
    const calls = onBookEvent.mock.calls.length;
    fireEvent.click(next, { detail: 1 });
    expect(onBookEvent).toHaveBeenCalledTimes(calls);
  });

  it('should treat a press that moves less than the drag start distance as a click', () => {
    const { onBookEvent, region } = renderSpread();
    const next = screen.getByRole('button', { name: '다음 쪽' });
    fireEvent.pointerDown(next, { pointerId: 4, button: 0, clientX: 1300, clientY: 500 });
    fireEvent.pointerMove(next, { pointerId: 4, buttons: 1, clientX: 1293, clientY: 500 });
    fireEvent.pointerUp(next, { pointerId: 4, clientX: 1293, clientY: 500 });
    expect(region).toHaveAttribute('data-phase', 'open');
    expect(eventTypes(onBookEvent)).toEqual([]);
    fireEvent.click(next, { detail: 1, clientX: 1293, clientY: 500 });
    expect(eventTypes(onBookEvent)).toEqual(['turn-click']);
  });

  it('should not turn on the click that follows a release far from the press without a drag', () => {
    const { onBookEvent } = renderSpread();
    const next = screen.getByRole('button', { name: '다음 쪽' });
    fireEvent.pointerDown(next, { pointerId: 11, button: 0, clientX: 1300, clientY: 500 });
    fireEvent.pointerUp(next, { pointerId: 11, clientX: 1300, clientY: 530 });
    fireEvent.click(next, { detail: 1, clientX: 1300, clientY: 530 });
    expect(onBookEvent).not.toHaveBeenCalled();
  });

  it('should end a drag on a move without pressed buttons and never start one from hovering', () => {
    const { onBookEvent, region } = renderSpread();
    fireEvent.pointerDown(region, { pointerId: 5, button: 0, clientX: 1300, clientY: 500 });
    fireEvent.pointerMove(region, { pointerId: 5, buttons: 1, clientX: 1280, clientY: 500 });
    fireEvent.pointerMove(region, { pointerId: 5, buttons: 0, clientX: 900, clientY: 500 });
    expect(onBookEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'turn-drag-end', point: { x: 900 - 213, y: 388 } })
    );
    // pointerup을 놓친 채(누른 상태) 버튼 없이 움직이면 드래그가 시작되지 않는다.
    fireEvent.pointerDown(region, { pointerId: 6, button: 0, clientX: 1300, clientY: 500 });
    fireEvent.pointerMove(region, { pointerId: 6, buttons: 0, clientX: 1000, clientY: 500 });
    fireEvent.pointerMove(region, { pointerId: 6, buttons: 0, clientX: 700, clientY: 500 });
    expect(eventTypes(onBookEvent)).toEqual(['turn-drag-start', 'turn-drag-end']);
  });

  it('should cancel the drag when the pointer capture is lost', () => {
    const { onBookEvent, region } = renderSpread();
    fireEvent.pointerDown(region, { pointerId: 7, button: 0, clientX: 1300, clientY: 500 });
    fireEvent.pointerMove(region, { pointerId: 7, buttons: 1, clientX: 1280, clientY: 500 });
    fireEvent.lostPointerCapture(region, { pointerId: 7 });
    fireEvent.pointerMove(region, { pointerId: 7, buttons: 1, clientX: 900, clientY: 500 });
    expect(eventTypes(onBookEvent)).toEqual(['turn-drag-start', 'turn-drag-cancel']);
  });

  it('should ignore secondary buttons, presses outside the drag zones and the screen edge', () => {
    const { onBookEvent, region } = renderSpread();
    fireEvent.pointerDown(region, { pointerId: 1, button: 2, clientX: 1300, clientY: 500 });
    fireEvent.pointerMove(region, { pointerId: 1, buttons: 2, clientX: 1000, clientY: 500 });
    fireEvent.pointerDown(region, { pointerId: 2, button: 0, clientX: 720, clientY: 450 });
    fireEvent.pointerMove(region, { pointerId: 2, buttons: 1, clientX: 600, clientY: 450 });
    fireEvent.pointerUp(region, { pointerId: 2, clientX: 600, clientY: 450 });
    fireEvent.pointerDown(region, { pointerId: 3, button: 0, clientX: 1430, clientY: 500 });
    fireEvent.pointerMove(region, { pointerId: 3, buttons: 1, clientX: 1300, clientY: 500 });
    fireEvent.pointerUp(region, { pointerId: 3, clientX: 1300, clientY: 500 });
    expect(onBookEvent).not.toHaveBeenCalled();
  });

  it('should let a turn start from anywhere on a single page, split at its middle', () => {
    const single = computeOpenGeometry({ width: 390, height: 844 }, 'single');
    const { onBookEvent, region } = renderSpread({ phase: 'open', view: { layout: 'single', page: 4 } }, false, single);
    const y = single.book.y + single.book.height / 2;
    const rightOfMiddle = single.book.x + single.book.width * 0.6;
    fireEvent.pointerDown(region, { pointerId: 8, button: 0, clientX: rightOfMiddle, clientY: y });
    fireEvent.pointerMove(region, { pointerId: 8, buttons: 1, clientX: rightOfMiddle - 20, clientY: y });
    expect(onBookEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'turn-drag-start', direction: 'forward' })
    );
    fireEvent.pointerUp(region, { pointerId: 8, clientX: rightOfMiddle - 20, clientY: y });
    const leftOfMiddle = single.book.x + single.book.width * 0.4;
    fireEvent.pointerDown(region, { pointerId: 9, button: 0, clientX: leftOfMiddle, clientY: y });
    fireEvent.pointerMove(region, { pointerId: 9, buttons: 1, clientX: leftOfMiddle + 20, clientY: y });
    expect(onBookEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'turn-drag-start', direction: 'backward' })
    );
  });

  it('should take turn input while a leaf settles, so each press turns a page', () => {
    const { onBookEvent, region } = renderSpread(turningScene('click'));
    expect(region).toHaveAttribute('data-phase', 'turning');
    fireEvent.keyDown(region, { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('button', { name: '다음 쪽' }));
    expect(eventTypes(onBookEvent)).toEqual(['turn-click', 'turn-click']);
  });

  it('should ignore clicks and keys while a leaf is being dragged', () => {
    const { onBookEvent, region } = renderSpread(turningScene('drag'));
    fireEvent.keyDown(region, { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('button', { name: '다음 쪽' }));
    expect(onBookEvent).not.toHaveBeenCalled();
  });

  it('should move focus out of the pages before they become inert', () => {
    const { onBookEvent, region } = renderSpread();
    const pages = region.querySelector('.book__pages');
    const probe = document.createElement('button');
    pages?.append(probe);
    probe.focus();
    expect(probe).toHaveFocus();
    fireEvent.keyDown(probe, { key: 'ArrowLeft' });
    expect(region).toHaveFocus();
    expect(onBookEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'turn-click', direction: 'backward' })
    );

    probe.focus();
    fireEvent.pointerDown(region, { pointerId: 10, button: 0, clientX: 1300, clientY: 500 });
    fireEvent.pointerMove(region, { pointerId: 10, buttons: 1, clientX: 1280, clientY: 500 });
    expect(onBookEvent).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'turn-drag-start' }));
    expect(region).toHaveFocus();
  });

  it('should hide the fold shade on a single page', () => {
    const single = computeOpenGeometry({ width: 390, height: 844 }, 'single');
    render(
      <BookSpread
        scene={{ phase: 'open', view: { layout: 'single', page: 8 } }}
        geometry={single}
        pageCount={8}
        reducedMotion
        takeFocus
        onBookEvent={vi.fn()}
      />
    );
    const region = screen.getByRole('region', { name: '펼친 책' });
    expect(region.querySelector('.book__fold-shade')).toBeNull();
    expect(region).toHaveAttribute('data-motion', 'reduced');
    expect(screen.queryByRole('button', { name: '다음 쪽' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '뒤표지 덮기' })).toHaveAttribute('data-action', 'close');
  });

  it('should turn the end buttons into cover buttons that send the same turn input', () => {
    const { onBookEvent } = renderSpread({ phase: 'open', view: { layout: 'spread', spread: 0 } });
    const closeFront = screen.getByRole('button', { name: '앞표지 덮기' });
    expect(closeFront).not.toHaveAttribute('aria-disabled');
    expect(screen.getByRole('button', { name: '다음 쪽' })).toHaveAttribute('data-action', 'turn');
    fireEvent.click(closeFront);
    expect(onBookEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'turn-click', direction: 'backward' })
    );
  });

  it('should start a cover drag from the outer band of the first spread', () => {
    const { onBookEvent, region } = renderSpread({ phase: 'open', view: { layout: 'spread', spread: 0 } });
    fireEvent.pointerDown(region, { pointerId: 12, button: 0, clientX: 250, clientY: 500 });
    fireEvent.pointerMove(region, { pointerId: 12, buttons: 1, clientX: 270, clientY: 500 });
    expect(onBookEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'turn-drag-start', direction: 'backward' })
    );
  });

  it('should keep the pointer and the drag going while the cover is being closed by hand', () => {
    const view = { layout: 'spread', spread: 0 } as const;
    const setup = { frame: turnFrame(geometry, 'backward'), direction: 'backward' as const, page: geometry.page };
    const drag = beginCoverDrag(
      { ...setup, lens: coverLens(setup, geometry) },
      { x: 10, y: 300 },
      { x: 30, y: 300 },
      0
    );
    const { onBookEvent, region } = renderSpread({
      phase: 'closing',
      side: 'front',
      view,
      page: geometry.page,
      stage: { type: 'drag', drag },
    });
    expect(region).toHaveAttribute('data-phase', 'closing');
    expect(region.querySelectorAll('[data-role="rest"]')).toHaveLength(2);
    // 펼친 책은 보이지 않는 채 포인터만 붙잡고 있으므로 쪽은 접근성 트리·탭 순서에서 뺀다.
    for (const layer of region.querySelectorAll('[data-role="rest"]')) {
      expect(layer).toHaveAttribute('inert');
    }
    // 끄는 중에는 클릭·키 넘김을 받지 않는다.
    fireEvent.keyDown(region, { key: 'ArrowLeft' });
    fireEvent.click(screen.getByRole('button', { name: '앞표지 덮기' }));
    expect(onBookEvent).not.toHaveBeenCalled();
  });
});
