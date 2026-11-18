import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BookEvent } from '@/model/book/book-state';
import { computeClosedPlacement, computeOpenGeometry, SCREEN_EDGE_DRAG_GUARD_PX } from '@/model/book/geometry';
import type { TransitionPose } from '@/model/book/opening';
import { isPointInConvexPolygon, outlineBounds, projectedBookOutline } from '@/model/book/projection';
import type { Quat } from '@/model/book/quaternion';
import { IDENTITY_QUAT, multiplyQuat, quatFromAxisAngle, X_AXIS } from '@/model/book/quaternion';
import { facingOrientation, INITIAL_ORIENTATION, restOrientation } from '@/model/book/rotation';
import type { Vec2 } from '@/model/fold';

import { ClosedBook } from '../closed-book';

const viewport = { width: 1440, height: 900 };
const geometry = computeOpenGeometry(viewport, 'spread');
const center = { x: 720, y: 450 };

function renderClosedBook(overrides: Partial<React.ComponentProps<typeof ClosedBook>> = {}) {
  const onBookEvent = vi.fn<(event: BookEvent) => void>();
  render(
    <ClosedBook
      viewport={viewport}
      geometry={geometry}
      orientation={INITIAL_ORIENTATION}
      transition={null}
      phase="closed"
      motion="rest"
      reducedMotion={false}
      className="extra"
      onBookEvent={onBookEvent}
      {...overrides}
    />
  );
  return {
    onBookEvent,
    button: screen.getByRole('button', { name: '책 펼치기' }),
    surface: document.querySelector<HTMLElement>('.closed-surface'),
    stage: document.querySelector<HTMLElement>('.closed-stage'),
  };
}

function eventTypes(onBookEvent: ReturnType<typeof renderClosedBook>['onBookEvent']): string[] {
  return onBookEvent.mock.calls.map(([event]) => event.type);
}

function transition(pose: Partial<TransitionPose>, page = 0): React.ComponentProps<typeof ClosedBook>['transition'] {
  return {
    pose: {
      orientation: IDENTITY_QUAT,
      side: 'front',
      coverOpen: 0,
      travel: 0,
      handoff: 0,
      crossfade: false,
      ...pose,
    },
    view: { layout: 'spread', spread: page },
  };
}

/** 책을 기울인 자세(화면 축 z로 35° 돌리고 대각 축으로 40°). 투영 다각형을 감싼 사각형의 모서리가 비어 있다. */
const TILTED: Quat = multiplyQuat(
  quatFromAxisAngle({ x: 1, y: 1, z: 0 }, 40),
  multiplyQuat(quatFromAxisAngle({ x: 0, y: 0, z: 1 }, 35), INITIAL_ORIENTATION)
);

/** 감싼 사각형 안이면서 투영 다각형 밖인 점(다각형에서 8px 넘게 떨어진 곳). */
function emptyCornerOf(orientation: Quat): Vec2 {
  const outline = projectedBookOutline(viewport, computeClosedPlacement(viewport, geometry), orientation);
  const bounds = outlineBounds(outline);
  for (let dy = 4; dy < bounds.height / 2; dy += 4) {
    for (let dx = 4; dx < bounds.width / 2; dx += 4) {
      const point = { x: bounds.x + dx, y: bounds.y + dy };
      const near = [-8, 0, 8].some(ox =>
        [-8, 0, 8].some(oy => isPointInConvexPolygon({ x: point.x + ox, y: point.y + oy }, outline))
      );
      if (!near) {
        return point;
      }
    }
  }
  throw new Error('빈 모서리를 찾지 못했다');
}

afterEach(() => {
  Reflect.deleteProperty(Element.prototype, 'setPointerCapture');
});

describe('ClosedBook', () => {
  it('should cover the projected book with one button and keep the 3D faces out of the accessibility tree', () => {
    const { button, surface, stage } = renderClosedBook();
    const outline = projectedBookOutline(viewport, computeClosedPlacement(viewport, geometry), INITIAL_ORIENTATION);
    const bounds = outlineBounds(outline);
    expect(button.style.width).toBe(`${bounds.width}px`);
    expect(button.style.left).toBe(`${bounds.x}px`);
    expect(document.querySelector('.closed-book')).toHaveAttribute('aria-hidden', 'true');
    expect(document.querySelector('.closed-book')?.getAttribute('style')).toContain('matrix3d(');
    expect(stage).toHaveClass('extra');
    expect(stage).toHaveAttribute('data-phase', 'closed');
    expect(stage?.style.perspective).toBe('2400px');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    // 바깥 회전 영역은 화면 전체(마우스), touch-action: none을 거는 안쪽은 가장자리를 뺀다(safe area가 없으면 좌우 24px).
    expect(surface).toHaveClass('inset-0');
    expect(surface).not.toHaveClass('touch-none');
    const touchArea = surface?.querySelector<HTMLElement>('.closed-surface__touch');
    expect(touchArea).toHaveClass('touch-none');
    expect(touchArea?.style.left).toBe(`${SCREEN_EDGE_DRAG_GUARD_PX}px`);
    expect(touchArea?.style.right).toBe(`${SCREEN_EDGE_DRAG_GUARD_PX}px`);
    expect(touchArea?.style.top).toBe('0px');
    expect(surface).toHaveAttribute('aria-hidden', 'true');
  });

  it('should grab on press anywhere, spin while dragging and release with a velocity', () => {
    const capture = vi.fn();
    Object.defineProperty(Element.prototype, 'setPointerCapture', { configurable: true, value: capture });
    const { surface, onBookEvent } = renderClosedBook();
    const notPrevented = fireEvent.pointerDown(surface!, {
      pointerId: 4,
      pointerType: 'mouse',
      button: 0,
      clientX: 200,
      clientY: 700,
    });
    expect(notPrevented).toBe(false);
    expect(capture).toHaveBeenCalledWith(4);
    expect(capture.mock.contexts[0]).toBe(surface);
    fireEvent.pointerMove(surface!, { pointerId: 4, buttons: 1, clientX: 204, clientY: 700 });
    fireEvent.pointerMove(surface!, { pointerId: 4, buttons: 1, clientX: 260, clientY: 690 });
    expect(onBookEvent).toHaveBeenLastCalledWith({ type: 'spin-drag', delta: { x: 60, y: -10 } });
    fireEvent.pointerUp(surface!, { pointerId: 4, clientX: 280, clientY: 690 });
    expect(onBookEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'spin-release', delta: { x: 20, y: 0 }, reducedMotion: false })
    );
    expect(eventTypes(onBookEvent)).toEqual(['spin-grab', 'spin-drag', 'spin-release']);
  });

  it('should open on a tap on the book but do nothing on a tap on an empty spot', () => {
    const { surface, button, onBookEvent } = renderClosedBook({ reducedMotion: true });
    fireEvent.pointerDown(surface!, { pointerId: 1, button: 0, clientX: 150, clientY: 150 });
    fireEvent.pointerUp(surface!, { pointerId: 1, clientX: 152, clientY: 150 });
    fireEvent.click(surface!, { detail: 1 });
    expect(eventTypes(onBookEvent)).toEqual(['spin-grab']);
    fireEvent.pointerDown(button, { pointerId: 2, button: 0, clientX: center.x, clientY: center.y });
    fireEvent.pointerUp(button, { pointerId: 2, clientX: center.x + 3, clientY: center.y });
    expect(onBookEvent).toHaveBeenLastCalledWith({ type: 'open', reducedMotion: true });
    // 포인터 탭 뒤에 오는 버튼 click(detail 1)은 다시 펼치지 않는다.
    fireEvent.click(button, { detail: 1 });
    expect(eventTypes(onBookEvent)).toEqual(['spin-grab', 'spin-grab', 'open']);
  });

  it('should not open on a tap in an empty corner of the button box when the book is tilted', () => {
    const { button, onBookEvent } = renderClosedBook({ orientation: TILTED, reducedMotion: true });
    const corner = emptyCornerOf(TILTED);
    // 버튼(투영 다각형을 감싼 사각형) 안이다.
    expect(corner.x).toBeGreaterThanOrEqual(Number.parseFloat(button.style.left));
    expect(corner.y).toBeGreaterThanOrEqual(Number.parseFloat(button.style.top));
    fireEvent.pointerDown(button, { pointerId: 1, button: 0, clientX: corner.x, clientY: corner.y });
    fireEvent.pointerUp(button, { pointerId: 1, clientX: corner.x, clientY: corner.y });
    fireEvent.click(button, { detail: 1 });
    expect(eventTypes(onBookEvent)).toEqual(['spin-grab']);
    // 같은 자세에서 책 가운데 탭은 펼친다.
    fireEvent.pointerDown(button, { pointerId: 2, button: 0, clientX: center.x, clientY: center.y });
    fireEvent.pointerUp(button, { pointerId: 2, clientX: center.x, clientY: center.y });
    expect(onBookEvent).toHaveBeenLastCalledWith({ type: 'open', reducedMotion: true });
  });

  it('should hand reduced motion to the release so the book stops where it is let go', () => {
    const { surface, onBookEvent } = renderClosedBook({ reducedMotion: true });
    fireEvent.pointerDown(surface!, { pointerId: 3, button: 0, clientX: 200, clientY: 700 });
    fireEvent.pointerMove(surface!, { pointerId: 3, buttons: 1, clientX: 300, clientY: 700 });
    fireEvent.pointerUp(surface!, { pointerId: 3, clientX: 320, clientY: 700 });
    expect(onBookEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'spin-release', reducedMotion: true })
    );
  });

  it('should open from keyboard or assistive technology activation', () => {
    const { button, onBookEvent } = renderClosedBook();
    fireEvent.click(button, { detail: 0 });
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyDown(button, { key: ' ' });
    fireEvent.keyDown(button, { key: 'Tab' });
    expect(eventTypes(onBookEvent)).toEqual(['open', 'open', 'open']);
  });

  it('should open with Enter or Space from the page, but leave them to other controls', () => {
    const { onBookEvent } = renderClosedBook();
    fireEvent.keyDown(document.body, { key: 'Enter' });
    fireEvent.keyDown(document.body, { key: ' ' });
    expect(eventTypes(onBookEvent)).toEqual(['open', 'open']);
    // 다른 컨트롤의 Enter, 한글 조합 중의 Enter, 단축키는 받지 않는다.
    const other = document.createElement('button');
    document.body.append(other);
    fireEvent.keyDown(other, { key: 'Enter' });
    other.remove();
    fireEvent.keyDown(document.body, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(document.body, { key: 'Enter', metaKey: true });
    expect(onBookEvent).toHaveBeenCalledTimes(2);
    cleanup();
    // 펼치는 중에는 받지 않는다.
    const opening = renderClosedBook({ phase: 'opening', transition: transition({}) });
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(opening.onBookEvent).not.toHaveBeenCalled();
  });

  it('should turn while arrows are held anywhere on the page, combining them and ignoring key repeats', () => {
    const { button, onBookEvent } = renderClosedBook();
    const directions = () =>
      onBookEvent.mock.calls.map(([event]) => (event.type === 'key-spin' ? event.direction : event.type));
    // 포커스가 책에 없어도(body) 받는다.
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    // 누르고 있는 동안 오는 자동 반복은 무시한다.
    fireEvent.keyDown(document.body, { key: 'ArrowRight', repeat: true });
    // 책 버튼에 포커스가 있어도 같은 입력이다(한 번만 받는다).
    fireEvent.keyDown(button, { key: 'ArrowUp' });
    fireEvent.keyUp(document.body, { key: 'ArrowRight' });
    fireEvent.keyUp(button, { key: 'ArrowUp' });
    // 누르지 않은 키를 떼는 것은 상관없다.
    fireEvent.keyUp(document.body, { key: 'ArrowDown' });
    fireEvent.keyUp(document.body, { key: 'Enter' });
    expect(directions()).toEqual([
      { x: 1, y: 0 },
      { x: 1, y: -1 },
      { x: 0, y: -1 },
      { x: 0, y: 0 },
    ]);
    const keyEvent = createEvent.keyDown(document.body, { key: 'ArrowLeft' });
    fireEvent(document.body, keyEvent);
    // 화살표가 페이지를 스크롤하지 않는다.
    expect(keyEvent.defaultPrevented).toBe(true);
  });

  it('should leave arrows to text fields, already handled keys and a book that is not closed', () => {
    const { onBookEvent } = renderClosedBook();
    const input = document.createElement('input');
    document.body.append(input);
    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    input.remove();
    const handled = createEvent.keyDown(document.body, { key: 'ArrowLeft' });
    handled.preventDefault();
    fireEvent(document.body, handled);
    expect(onBookEvent).not.toHaveBeenCalled();
    cleanup();
    // 펼치는 중에는 받지 않는다.
    const opening = renderClosedBook({ phase: 'opening', transition: transition({}) });
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(opening.onBookEvent).not.toHaveBeenCalled();
  });

  it('should let go of held arrows when the window loses focus or on a command key, and leave shortcuts alone', () => {
    const { onBookEvent } = renderClosedBook();
    const lastDirection = () => {
      const last = onBookEvent.mock.calls.at(-1)?.[0];
      return last?.type === 'key-spin' ? last.direction : null;
    };
    fireEvent.keyDown(document.body, { key: 'ArrowDown' });
    fireEvent.blur(window);
    expect(lastDirection()).toEqual({ x: 0, y: 0 });
    // 이미 다 뗐으면 다시 알리지 않는다.
    fireEvent.blur(window);
    expect(onBookEvent).toHaveBeenCalledTimes(2);
    // macOS는 Meta를 누른 동안 keyup을 보내지 않아 Meta를 누르면 다 뗀 것으로 본다. 단축키 자체는 가로채지 않는다.
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    fireEvent.keyDown(document.body, { key: 'Meta', metaKey: true });
    expect(lastDirection()).toEqual({ x: 0, y: 0 });
    const shortcut = createEvent.keyDown(document.body, { key: 'ArrowRight', metaKey: true });
    fireEvent(document.body, shortcut);
    expect(shortcut.defaultPrevented).toBe(false);
    expect(onBookEvent).toHaveBeenCalledTimes(4);
  });

  it('should take a mouse press at the very screen edge', () => {
    const { surface, onBookEvent } = renderClosedBook();
    fireEvent.pointerDown(surface!, { pointerId: 5, pointerType: 'mouse', button: 0, clientX: 2, clientY: 450 });
    fireEvent.pointerMove(surface!, { pointerId: 5, buttons: 1, clientX: 200, clientY: 450 });
    expect(eventTypes(onBookEvent)).toEqual(['spin-grab', 'spin-drag']);
  });

  it('should ignore touches at the screen edges, secondary buttons and other pointers', () => {
    const { surface, button, onBookEvent } = renderClosedBook();
    fireEvent.pointerDown(button, {
      pointerId: 1,
      pointerType: 'touch',
      button: 0,
      clientX: SCREEN_EDGE_DRAG_GUARD_PX - 4,
      clientY: 450,
    });
    fireEvent.pointerMove(button, { pointerId: 1, buttons: 1, clientX: 300, clientY: 450 });
    fireEvent.pointerDown(surface!, { pointerId: 2, button: 2, clientX: 300, clientY: 450 });
    fireEvent.pointerMove(surface!, { pointerId: 2, buttons: 2, clientX: 500, clientY: 450 });
    expect(onBookEvent).not.toHaveBeenCalled();
    fireEvent.pointerDown(surface!, { pointerId: 3, button: 0, clientX: 300, clientY: 450 });
    fireEvent.pointerMove(surface!, { pointerId: 9, buttons: 1, clientX: 500, clientY: 450 });
    expect(eventTypes(onBookEvent)).toEqual(['spin-grab']);
  });

  it('should treat a move without pressed buttons as the missed release, and a lost capture as a stop', () => {
    const { surface, onBookEvent } = renderClosedBook();
    fireEvent.pointerDown(surface!, { pointerId: 5, button: 0, clientX: 300, clientY: 400 });
    fireEvent.pointerMove(surface!, { pointerId: 5, buttons: 1, clientX: 360, clientY: 400 });
    fireEvent.pointerMove(surface!, { pointerId: 5, buttons: 0, clientX: 380, clientY: 400 });
    expect(onBookEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'spin-release', delta: { x: 20, y: 0 } })
    );
    fireEvent.pointerDown(surface!, { pointerId: 6, button: 0, clientX: 300, clientY: 400 });
    fireEvent.pointerMove(surface!, { pointerId: 6, buttons: 1, clientX: 360, clientY: 400 });
    fireEvent.lostPointerCapture(surface!, { pointerId: 6 });
    expect(onBookEvent).toHaveBeenLastCalledWith({
      type: 'spin-release',
      delta: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      reducedMotion: false,
    });
    fireEvent.pointerMove(surface!, { pointerId: 6, buttons: 1, clientX: 500, clientY: 400 });
    fireEvent.pointerCancel(surface!, { pointerId: 6 });
    expect(eventTypes(onBookEvent)).toEqual([
      'spin-grab',
      'spin-drag',
      'spin-release',
      'spin-grab',
      'spin-drag',
      'spin-release',
    ]);
  });

  it('should hide faces whose rotated normal clearly faces away', () => {
    renderClosedBook();
    expect(document.querySelector('.closed-book__back')).toHaveStyle({ visibility: 'hidden' });
    expect(document.querySelector('.closed-book__cover-front')).not.toHaveStyle({ visibility: 'hidden' });
    // 아랫면은 첫 자세에서 살짝(z ≈ -0.14)만 돌아서 있어 숨기지 않고 backface-visibility에 맡긴다.
    expect(document.querySelector('.closed-book__bottom')).not.toHaveStyle({ visibility: 'hidden' });
  });

  it('should draw the name card art on the front and back covers as decoration over the card colour', () => {
    renderClosedBook();
    const front = document.querySelector<HTMLElement>('.closed-book__cover-front');
    const back = document.querySelector<HTMLElement>('.closed-book__back');
    expect(front?.querySelector('img')).toHaveAttribute('src', '/covers/front.webp');
    expect(back?.querySelector('img')).toHaveAttribute('src', '/covers/back.svg');
    for (const image of [front?.querySelector('img'), back?.querySelector('img')]) {
      expect(image).toHaveAttribute('alt', '');
    }
    expect(front?.querySelector('img')).toHaveAttribute('fetchpriority', 'high');
    // 그림이 오기 전에도 명함 바탕색이 보인다. 돌아선 면을 숨기는 visibility와 함께 건다.
    expect(front).toHaveStyle({ backgroundColor: '#ff9738' });
    expect(back).toHaveStyle({ backgroundColor: '#4614c4', visibility: 'hidden' });
  });

  it('should draw all six faces and show the bottom when the book is tipped toward the viewer', () => {
    renderClosedBook({ orientation: quatFromAxisAngle(X_AXIS, 90) });
    for (const face of ['cover-front', 'back', 'spine', 'fore', 'top', 'bottom']) {
      expect(document.querySelector(`.closed-book__${face}`)).toBeInTheDocument();
    }
    expect(document.querySelector('.closed-book__bottom')).not.toHaveStyle({ visibility: 'hidden' });
    expect(document.querySelector('.closed-book__top')).toHaveStyle({ visibility: 'hidden' });
    expect(screen.getByText('심완', { selector: '.closed-book__spine-label' })).toBeInTheDocument();
  });

  it('should warm the first spread on hover and focus', () => {
    const { button } = renderClosedBook();
    fireEvent.pointerEnter(button);
    fireEvent.focus(button);
    expect(document.head.querySelector('link[rel="preload"][href="/photos/forest.jpg"]')).not.toBeNull();
  });

  it('should show the inside of the front cover and the page under it while opening, and ignore the pointer', () => {
    const { button, stage, onBookEvent } = renderClosedBook({
      phase: 'opening',
      transition: transition({ coverOpen: 0.5, travel: 0.5 }),
    });
    expect(document.querySelector('.closed-surface')).toBeNull();
    expect(stage).not.toHaveStyle({ opacity: '0' });
    expect(document.querySelector('.closed-book')).toHaveAttribute('data-layout', 'spread');
    expect(document.querySelectorAll('.closed-book__page-chrome')).toHaveLength(2);
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(stage).toHaveAttribute('data-phase', 'opening');
    expect(screen.getByText('사진 · 임시')).toBeInTheDocument();
    expect(document.querySelector('.closed-book__under img')).toHaveAttribute('src', '/photos/forest.jpg');
    expect(document.querySelector('.closed-book__under')).toHaveAttribute('data-page-side', 'right');
    expect(document.querySelector<HTMLElement>('.closed-book')?.style.getPropertyValue('--cover-angle')).toBe('-90deg');
    fireEvent.pointerDown(button, { pointerId: 1, button: 0, clientX: 700, clientY: 400 });
    fireEvent.pointerMove(button, { pointerId: 1, buttons: 1, clientX: 800, clientY: 400 });
    fireEvent.pointerUp(button, { pointerId: 1, clientX: 800, clientY: 400 });
    expect(onBookEvent).not.toHaveBeenCalled();
  });

  it('should put the page under the cover before both boards so engines that paint in DOM order keep the board on top', () => {
    renderClosedBook({ phase: 'closing', transition: transition({ coverOpen: 0.07, travel: 0.3 }, 2) });
    const faces = Array.from(document.querySelector('.closed-book')?.children ?? []);
    const indexOf = (name: string) => faces.findIndex(face => face.classList.contains(name));
    expect(indexOf('closed-book__under')).toBe(0);
    expect(indexOf('closed-book__cover')).toBeGreaterThan(0);
    expect(indexOf('closed-book__back-cover')).toBeGreaterThan(0);
  });

  it('should hide the spine name when the spine is squeezed edge-on, as in the back resting pose', () => {
    renderClosedBook({ orientation: restOrientation('back') });
    expect(document.querySelector('.closed-book__spine-label')).toHaveStyle({ visibility: 'hidden' });
    cleanup();
    // 책등이 화면 쪽으로 돌아서면 보인다.
    renderClosedBook({ orientation: quatFromAxisAngle({ x: 0, y: 1, z: 0 }, 80) });
    expect(document.querySelector('.closed-book__spine-label')).not.toHaveStyle({ visibility: 'hidden' });
  });

  it('should open the back cover board over the last page when closing to the back', () => {
    renderClosedBook({
      phase: 'closing',
      transition: transition({ orientation: facingOrientation('back'), side: 'back', coverOpen: 0.25, travel: 1 }, 3),
    });
    const book = document.querySelector<HTMLElement>('.closed-book');
    expect(book?.style.getPropertyValue('--back-cover-angle')).toBe('45deg');
    expect(book?.style.getPropertyValue('--cover-angle')).toBe('0deg');
    expect(screen.getByText('판권면 · 임시')).toBeInTheDocument();
    expect(document.querySelector('.closed-book__back-inside')).toHaveAttribute('data-page-side', 'right');
    expect(document.querySelector('.closed-book__under')).toHaveAttribute('data-cover', 'back');
    expect(document.querySelector('.closed-book__under img')).toHaveAttribute('src', '/photos/night.jpg');
    expect(document.querySelector('.closed-book__cover-inside')).toBeNull();
  });

  it('should fade over the open book while handing over, and draw no pages while only crossfading', () => {
    const { stage } = renderClosedBook({
      phase: 'opening',
      transition: transition({ coverOpen: 1, travel: 1, handoff: 0.25 }),
    });
    expect(stage).toHaveStyle({ opacity: '0.75' });
  });

  it('should not draw the inner pages during a reduced motion crossfade', () => {
    renderClosedBook({ phase: 'closing', transition: transition({ handoff: 0.5, crossfade: true }) });
    expect(document.querySelector('.closed-book__under')).toBeNull();
    expect(document.querySelector('.closed-stage')).toHaveStyle({ opacity: '0.5' });
  });
});
