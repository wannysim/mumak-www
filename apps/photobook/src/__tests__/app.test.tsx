import { act, createEvent, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { App } from '@/app';
import { OPEN_HANDOFF_DURATION_MS, REDUCED_MOTION_CROSSFADE_MS } from '@/model/book/opening';
import { renderedFacingFace } from '@/test/book-faces';
import { resizeViewport, stubReducedMotion } from '@/test/browser';

function openBookButton() {
  return screen.getByRole('button', { name: '책 펼치기' });
}

function folio() {
  return document.querySelector('[data-folio]');
}

function closedStage() {
  return document.querySelector<HTMLElement>('.closed-stage');
}

/** 닫힌 책이 정면에 둔 면(그려진 자세로 판정). 앱은 면 이름을 보이지 않는다. */
function shownFace() {
  const book = document.querySelector<HTMLElement>('.closed-book');
  if (book === null) {
    throw new Error('닫힌 책이 없다');
  }
  return renderedFacingFace(book);
}

function bookRegion() {
  return screen.getByRole('region', { name: '펼친 책' });
}

/** 프레임 시계를 가짜로 바꾼다. 펼침·자동 착지는 requestAnimationFrame 시각으로만 움직인다. */
function useFakeFrames() {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** Tab으로 책에 온 키보드 사용자처럼 책 버튼에 포커스를 두고 Enter로 펼친다. 포커스는 책 영역으로 옮겨진다. */
function openWithEnter() {
  openBookButton().focus();
  fireEvent.keyDown(openBookButton(), { key: 'Enter' });
  advance(2000);
  return bookRegion();
}

function surface() {
  const element = document.querySelector<HTMLElement>('.closed-surface');
  if (element === null) {
    throw new Error('회전 영역이 없다');
  }
  return element;
}

/** 1024 × 768 jsdom 화면의 닫힌 책 가운데와 책 밖 빈 곳. */
const BOOK_CENTER = { clientX: 512, clientY: 384 };
const EMPTY_SPOT = { clientX: 100, clientY: 120 };

function tap(target: HTMLElement, point: { clientX: number; clientY: number }, pointerId = 1) {
  fireEvent.pointerDown(target, { pointerId, button: 0, ...point });
  fireEvent.pointerUp(target, { pointerId, ...point });
  fireEvent.click(target, { detail: 1, ...point });
}

/** 시각을 정해 포인터 이벤트를 보낸다. jsdom은 timeStamp를 Date.now()(정수 ms)로 찍어 같은 ms에 몰리면 속도가 0이 된다. */
function pointerAt(
  type: 'pointerDown' | 'pointerMove' | 'pointerUp',
  target: HTMLElement,
  init: Record<string, number>,
  timeStamp: number
) {
  const event = createEvent[type](target, init);
  Object.defineProperty(event, 'timeStamp', { value: timeStamp });
  fireEvent(target, event);
}

function pressEscape(target: Element = document.body) {
  fireEvent.keyDown(target, { key: 'Escape' });
}

describe('App', () => {
  it('should show the closed book with its cover described for screen readers and no page number', () => {
    stubReducedMotion(true);
    render(<App />);
    expect(screen.getByRole('main', { name: 'Photobook' })).toBeInTheDocument();
    const button = openBookButton();
    expect(button).toHaveAccessibleDescription(/앞표지: 심완, 사진 찍는 개발자\. 뒤표지: example@mail\.com/);
    // 잡지 표지에는 쪽 번호가 없다. 펼치면 나타난다.
    expect(folio()).toBeNull();
    expect(shownFace()).toBe('front');
    expect(screen.queryByRole('region', { name: '펼친 책' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('should turn the closed book while an arrow key is held, wherever the focus is', () => {
    useFakeFrames();
    stubReducedMotion(true);
    render(<App />);
    // 누르고 있는 동안만 돈다(동작 줄이기면 가속·관성 없이 60°/s). 1.5초면 약 90°라 책등이 정면에 온다.
    // 책에 포커스가 없어도(body) 받는다.
    expect(document.activeElement).toBe(document.body);
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(closedStage()).toHaveAttribute('data-motion', 'key');
    advance(1500);
    fireEvent.keyUp(document.body, { key: 'ArrowRight' });
    expect(closedStage()).toHaveAttribute('data-motion', 'rest');
    expect(shownFace()).toBe('spine');
    fireEvent.keyDown(openBookButton(), { key: 'ArrowLeft' });
    advance(3000);
    fireEvent.keyUp(openBookButton(), { key: 'ArrowLeft' });
    expect(shownFace()).toBe('fore');
    expect(folio()).toBeNull();
    fireEvent.keyDown(openBookButton(), { key: 'Tab' });
    expect(openBookButton()).toBeInTheDocument();
  });

  it('should work from the page without focusing the book: Enter opens, arrows turn, Esc closes', () => {
    useFakeFrames();
    stubReducedMotion(true);
    render(<App />);
    expect(document.activeElement).toBe(document.body);
    fireEvent.keyDown(document.body, { key: 'Enter' });
    advance(2000);
    expect(bookRegion()).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('01–02쪽');
    // 포커스를 책으로 옮기지 않는다. 그래서 책에 포커스 표시가 생기지 않는다(2026-11-16 사용자 결정).
    expect(document.activeElement).toBe(document.body);
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    advance(1000);
    expect(folio()).toHaveTextContent('03–04/08');
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    advance(1000);
    expect(folio()).toHaveTextContent('01–02/08');
    pressEscape();
    advance(1000);
    expect(screen.queryByRole('region', { name: '펼친 책' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('책을 덮었다, 앞표지');
    expect(document.activeElement).toBe(document.body);
  });

  it('should open with Enter, move focus into the book and announce the first spread once', () => {
    useFakeFrames();
    stubReducedMotion(true);
    render(<App />);
    const region = openWithEnter();
    expect(region).toHaveFocus();
    expect(closedStage()).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('01–02쪽');
    expect(folio()).toHaveTextContent('01–02/08');
    expect(folio()).toHaveTextContent('01–02쪽, 전체 8쪽');
    expect(within(region).getByRole('img', { name: /숲속 오솔길/ })).toBeInTheDocument();
  });

  it('should crossfade the closed book into the open book with reduced motion', () => {
    useFakeFrames();
    stubReducedMotion(true);
    render(<App />);
    fireEvent.click(openBookButton());
    advance(REDUCED_MOTION_CROSSFADE_MS / 2);
    const region = bookRegion();
    expect(Number(region.style.opacity)).toBeGreaterThan(0);
    expect(Number(region.style.opacity)).toBeLessThan(1);
    expect(Number(closedStage()?.style.opacity)).toBeCloseTo(1 - Number(region.style.opacity));
    expect(closedStage()?.querySelector<HTMLElement>('.closed-book')?.style.getPropertyValue('--cover-angle')).toBe(
      '0deg'
    );
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    advance(REDUCED_MOTION_CROSSFADE_MS);
    expect(closedStage()).toBeNull();
    expect(region.style.opacity).toBe('');
    expect(screen.getByRole('status')).toHaveTextContent('01–02쪽');
  });

  it('should turn with the next button and the arrow keys, and offer to close the cover at both ends', () => {
    useFakeFrames();
    stubReducedMotion(true);
    render(<App />);
    const region = openWithEnter();
    expect(within(region).queryByRole('button', { name: '이전 쪽' })).not.toBeInTheDocument();
    expect(within(region).getByRole('button', { name: '앞표지 덮기' })).not.toHaveAttribute('aria-disabled');
    const next = within(region).getByRole('button', { name: '다음 쪽' });

    fireEvent.click(next);
    expect(screen.getByRole('status')).toHaveTextContent('03–04쪽');
    expect(folio()).toHaveTextContent('03–04/08');
    expect(within(region).getByRole('button', { name: '이전 쪽' })).toBeInTheDocument();

    fireEvent.keyDown(region, { key: 'ArrowRight' });
    fireEvent.keyDown(next, { key: 'ArrowRight' });
    expect(folio()).toHaveTextContent('07–08/08');
    expect(next).toHaveAccessibleName('뒤표지 덮기');
    expect(within(region).getByText('판권면 · 임시')).toBeInTheDocument();

    fireEvent.keyDown(region, { key: 'ArrowLeft' });
    expect(screen.getByRole('status')).toHaveTextContent('05–06쪽');
    fireEvent.keyDown(region, { key: 'ArrowUp' });
    expect(folio()).toHaveTextContent('05–06/08');
  });

  it('should show one page at a time on a tall phone screen', () => {
    useFakeFrames();
    stubReducedMotion(true);
    resizeViewport(390, 844);
    render(<App />);
    const region = openWithEnter();
    expect(region).toHaveAttribute('data-layout', 'single');
    expect(folio()).toHaveTextContent('02/08');
    expect(within(region).getAllByRole('img')).toHaveLength(1);
    fireEvent.click(within(region).getByRole('button', { name: '다음 쪽' }));
    expect(folio()).toHaveTextContent('03/08');
    expect(within(region).getAllByRole('img')).toHaveLength(1);
    expect(screen.getByRole('banner')).not.toHaveTextContent('지금 다음 호에');
  });

  it('should keep the visible page when the screen switches layout', () => {
    useFakeFrames();
    stubReducedMotion(true);
    render(<App />);
    const region = openWithEnter();
    fireEvent.click(within(region).getByRole('button', { name: '다음 쪽' }));
    resizeViewport(390, 844);
    expect(folio()).toHaveTextContent('03/08');
    expect(region).toHaveAttribute('data-layout', 'single');
  });

  it('should not bring back a turn dropped by a layout change when the screen size comes back', () => {
    useFakeFrames();
    stubReducedMotion(false);
    render(<App />);
    const region = openWithEnter();
    fireEvent.click(within(region).getByRole('button', { name: '다음 쪽' }));
    advance(200);
    expect(region).toHaveAttribute('data-phase', 'turning');
    resizeViewport(390, 844);
    expect(region).toHaveAttribute('data-phase', 'open');
    expect(folio()).toHaveTextContent('01/08');
    advance(2000);
    resizeViewport(1024, 768);
    advance(2000);
    expect(region).toHaveAttribute('data-phase', 'open');
    expect(folio()).toHaveTextContent('01–02/08');
    expect(screen.getByRole('status')).toHaveTextContent('01–02쪽');
  });

  it('should play the opening and the turn by frame time with full motion, handing over at the end', () => {
    useFakeFrames();
    stubReducedMotion(false);
    render(<App />);
    openBookButton().focus();
    fireEvent.keyDown(openBookButton(), { key: ' ' });
    expect(closedStage()).toHaveAttribute('data-phase', 'opening');
    expect(openBookButton()).toHaveAttribute('aria-disabled', 'true');
    advance(300);
    expect(screen.queryByRole('region', { name: '펼친 책' })).not.toBeInTheDocument();
    // 앞으로 돌기(약 98ms) + 표지 열기 650ms. 마지막 120ms는 3D 책과 펼친 책 DOM이 겹친다.
    advance(748 - 300 - OPEN_HANDOFF_DURATION_MS / 2);
    const region = bookRegion();
    expect(region).toHaveFocus();
    const reveal = Number(region.style.getPropertyValue('--chrome-reveal'));
    expect(reveal).toBeGreaterThan(0);
    expect(reveal).toBeLessThan(1);
    expect(Number(closedStage()?.style.opacity)).toBeCloseTo(1 - reveal);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    advance(2000);
    expect(closedStage()).toBeNull();
    expect(region.style.getPropertyValue('--chrome-reveal')).toBe('');
    expect(screen.getByRole('status')).toHaveTextContent('01–02쪽');

    fireEvent.click(within(region).getByRole('button', { name: '다음 쪽' }));
    expect(region).toHaveAttribute('data-phase', 'turning');
    expect(folio()).toHaveTextContent('01–02/08');
    expect(document.querySelector('[data-role="flap"]')).toHaveAttribute('inert');
    advance(1500);
    expect(region).toHaveAttribute('data-phase', 'open');
    expect(folio()).toHaveTextContent('03–04/08');
  });

  it('should turn one page per press even while a leaf is still landing', () => {
    useFakeFrames();
    stubReducedMotion(false);
    render(<App />);
    const region = openWithEnter();
    fireEvent.keyDown(region, { key: 'ArrowRight' });
    advance(100);
    fireEvent.keyDown(region, { key: 'ArrowRight' });
    expect(screen.getByRole('status')).toHaveTextContent('03–04쪽');
    advance(100);
    fireEvent.keyDown(region, { key: 'ArrowRight' });
    advance(2000);
    expect(folio()).toHaveTextContent('07–08/08');
    expect(screen.getByRole('status')).toHaveTextContent('07–08쪽');
  });

  it('should turn back to the front cover before opening from any face', () => {
    useFakeFrames();
    stubReducedMotion(false);
    render(<App />);
    fireEvent.keyDown(openBookButton(), { key: 'ArrowRight' });
    // 키 회전도 프레임 시각으로 돈다. 약 3.3초 누르면 반 바퀴쯤 돌아 뒷면이 보이고, 떼면 조금 더 돌다 선다.
    expect(shownFace()).toBe('front');
    advance(3300);
    fireEvent.keyUp(openBookButton(), { key: 'ArrowRight' });
    expect(closedStage()).toHaveAttribute('data-motion', 'spin');
    advance(1000);
    expect(closedStage()).toHaveAttribute('data-motion', 'rest');
    expect(shownFace()).toBe('back');
    fireEvent.keyDown(openBookButton(), { key: 'Enter' });
    advance(50);
    expect(shownFace()).toBe('back');
    // 여닫는 중에도 쪽 번호는 없다. 펼침이 끝나 착지하면 나타난다.
    expect(folio()).toBeNull();
    advance(650);
    expect(shownFace()).toBe('front');
  });

  it('should follow prefers-reduced-motion changes, even in the middle of the opening', () => {
    useFakeFrames();
    const motion = stubReducedMotion(false);
    render(<App />);
    fireEvent.keyDown(openBookButton(), { key: 'ArrowRight' });
    expect(closedStage()).toHaveAttribute('data-motion', 'key');
    advance(1500);
    fireEvent.keyUp(openBookButton(), { key: 'ArrowRight' });
    // 떼면 관성으로 돌다가, 동작 줄이기로 바뀌면 다음 프레임에 그 자리에 선다.
    expect(closedStage()).toHaveAttribute('data-motion', 'spin');
    motion.set(true);
    advance(16);
    expect(closedStage()).toHaveAttribute('data-motion', 'rest');
    expect(shownFace()).toBe('spine');
    motion.set(false);
    fireEvent.click(openBookButton());
    advance(100);
    expect(closedStage()).toHaveAttribute('data-phase', 'opening');
    motion.set(true);
    advance(16);
    expect(closedStage()).toBeNull();
    expect(bookRegion()).toHaveAttribute('data-motion', 'reduced');
    expect(screen.getByRole('status')).toHaveTextContent('01–02쪽');
  });

  it('should rotate when dragged anywhere on the screen, open only on a tap on the book', () => {
    useFakeFrames();
    stubReducedMotion(true);
    render(<App />);
    const area = surface();
    fireEvent.pointerDown(area, { pointerId: 1, button: 0, clientX: 150, clientY: 650 });
    fireEvent.pointerMove(area, { pointerId: 1, buttons: 1, clientX: 250, clientY: 650 });
    fireEvent.pointerMove(area, { pointerId: 1, buttons: 1, clientX: 380, clientY: 650 });
    fireEvent.pointerUp(area, { pointerId: 1, clientX: 380, clientY: 650 });
    fireEvent.click(area, { detail: 1 });
    expect(shownFace()).toBe('spine');
    advance(500);
    expect(screen.queryByRole('region', { name: '펼친 책' })).not.toBeInTheDocument();
    expect(closedStage()).toHaveAttribute('data-motion', 'rest');

    // 빈 곳 탭은 아무 일도 없다.
    tap(area, EMPTY_SPOT, 2);
    advance(500);
    expect(screen.queryByRole('region', { name: '펼친 책' })).not.toBeInTheDocument();
    expect(shownFace()).toBe('spine');

    tap(openBookButton(), BOOK_CENTER, 3);
    advance(500);
    expect(bookRegion()).toBeInTheDocument();
  });

  it('should keep spinning for a while after a flick and then stop', () => {
    useFakeFrames();
    stubReducedMotion(false);
    render(<App />);
    const area = surface();
    pointerAt('pointerDown', area, { pointerId: 1, button: 0, clientX: 150, clientY: 650 }, 1000);
    pointerAt('pointerMove', area, { pointerId: 1, buttons: 1, clientX: 250, clientY: 650 }, 1040);
    pointerAt('pointerUp', area, { pointerId: 1, clientX: 260, clientY: 650 }, 1050);
    expect(closedStage()).toHaveAttribute('data-motion', 'spin');
    const transform = () => document.querySelector<HTMLElement>('.closed-book')?.style.transform;
    advance(16);
    const early = transform();
    advance(100);
    expect(transform()).not.toBe(early);
    advance(5000);
    expect(closedStage()).toHaveAttribute('data-motion', 'rest');
    const rested = transform();
    advance(500);
    expect(transform()).toBe(rested);
  });

  it('should stop where it is let go after a flick with reduced motion', () => {
    useFakeFrames();
    stubReducedMotion(true);
    render(<App />);
    const area = surface();
    const transform = () => document.querySelector<HTMLElement>('.closed-book')?.style.transform;
    const before = transform();
    pointerAt('pointerDown', area, { pointerId: 1, button: 0, clientX: 150, clientY: 650 }, 1000);
    pointerAt('pointerMove', area, { pointerId: 1, buttons: 1, clientX: 250, clientY: 650 }, 1040);
    pointerAt('pointerUp', area, { pointerId: 1, clientX: 260, clientY: 650 }, 1050);
    // 끈 만큼은 돌지만 관성은 없다.
    expect(closedStage()).toHaveAttribute('data-motion', 'rest');
    const released = transform();
    expect(released).not.toBe(before);
    advance(500);
    expect(transform()).toBe(released);
  });

  it('should turn a page by dragging from the outer edge', () => {
    useFakeFrames();
    stubReducedMotion(true);
    render(<App />);
    const region = openWithEnter();
    const next = within(region).getByRole('button', { name: '다음 쪽' });
    // 1024 × 768 펼침: 오른쪽 쪽 바깥 가장자리는 화면 x = 944, 드래그 시작 영역은 x ≈ 892부터. 그 안에서 눌러 왼쪽으로 끈다.
    fireEvent.pointerDown(next, { pointerId: 7, button: 0, clientX: 920, clientY: 500 });
    fireEvent.pointerMove(next, { pointerId: 7, buttons: 1, clientX: 800, clientY: 500 });
    expect(region).toHaveAttribute('data-phase', 'turning');
    expect(folio()).toHaveTextContent('01–02/08');
    const upper = document.querySelector<HTMLElement>('[data-role="upper"]');
    expect(Number(upper?.style.opacity)).toBeLessThan(1);
    fireEvent.pointerMove(next, { pointerId: 7, buttons: 1, clientX: 300, clientY: 500 });
    fireEvent.pointerUp(next, { pointerId: 7, clientX: 300, clientY: 500 });
    fireEvent.click(next, { detail: 1 });
    expect(folio()).toHaveTextContent('03–04/08');
    expect(screen.getByRole('status')).toHaveTextContent('03–04쪽');
  });

  describe('closing the book again', () => {
    it('should close to the front with Esc from anywhere and announce once, leaving focus on the page when it was there', () => {
      useFakeFrames();
      stubReducedMotion(true);
      render(<App />);
      const region = openWithEnter();
      fireEvent.click(within(region).getByRole('button', { name: '다음 쪽' }));
      expect(folio()).toHaveTextContent('03–04/08');
      (document.activeElement as HTMLElement | null)?.blur();
      pressEscape();
      // 동작 줄이기면 짧은 투명도 교차만 한다.
      advance(REDUCED_MOTION_CROSSFADE_MS / 2);
      const fading = bookRegion();
      expect(Number(fading.style.opacity)).toBeGreaterThan(0);
      expect(Number(fading.style.opacity)).toBeLessThan(1);
      expect(Number(closedStage()?.style.opacity)).toBeCloseTo(1 - Number(fading.style.opacity));
      advance(REDUCED_MOTION_CROSSFADE_MS);
      expect(screen.queryByRole('region', { name: '펼친 책' })).not.toBeInTheDocument();
      expect(folio()).toBeNull();
      // 포커스가 body에서 Esc를 눌렀으니 사라진 노드가 없다. 책으로 옮기지 않아 포커스 표시가 생기지 않는다.
      expect(document.activeElement).toBe(document.body);
      expect(screen.getByRole('status')).toHaveTextContent('책을 덮었다, 앞표지');
      // 닫힌 책에서는 Esc가 아무 일도 하지 않는다.
      openBookButton().focus();
      pressEscape(openBookButton());
      advance(500);
      expect(screen.getByRole('status')).toHaveTextContent('책을 덮었다, 앞표지');
      expect(openBookButton()).toHaveFocus();
    });

    it('should move focus to the closed book as the closing starts, before the open book goes away', () => {
      useFakeFrames();
      stubReducedMotion(false);
      render(<App />);
      const region = openWithEnter();
      within(region).getByRole('button', { name: '다음 쪽' }).focus();
      pressEscape(document.activeElement ?? document.body);
      // 펼친 책 DOM은 넘겨주는 동안 아직 있지만 포커스는 이미 (전환 중 aria-disabled인) 닫힌 책 버튼에 있다.
      expect(bookRegion()).toBeInTheDocument();
      expect(openBookButton()).toHaveFocus();
      expect(openBookButton()).toHaveAttribute('aria-disabled', 'true');
      advance(OPEN_HANDOFF_DURATION_MS + 300);
      expect(screen.queryByRole('region', { name: '펼친 책' })).not.toBeInTheDocument();
      expect(closedStage()).toHaveAttribute('data-phase', 'closing');
      expect(document.activeElement).not.toBe(document.body);
      expect(openBookButton()).toHaveFocus();
      // 착지한 뒤에도 그대로다.
      advance(3000);
      expect(closedStage()).toHaveAttribute('data-phase', 'closed');
      expect(openBookButton()).toHaveFocus();
      expect(openBookButton()).not.toHaveAttribute('aria-disabled');
    });

    it('should move focus off the name button when it starts closing the book', () => {
      useFakeFrames();
      stubReducedMotion(false);
      render(<App />);
      openWithEnter();
      const name = screen.getByRole('button', { name: /^심완/ });
      name.focus();
      fireEvent.click(name);
      expect(openBookButton()).toHaveFocus();
      advance(3000);
      expect(screen.queryByRole('button', { name: /심완/ })).not.toBeInTheDocument();
      expect(openBookButton()).toHaveFocus();
    });

    it('should ignore Esc while the book is still opening', () => {
      useFakeFrames();
      stubReducedMotion(false);
      render(<App />);
      fireEvent.keyDown(openBookButton(), { key: 'Enter' });
      advance(200);
      pressEscape();
      advance(2000);
      expect(bookRegion()).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('01–02쪽');
    });

    it('should close to the front when the name in the running head is pressed', () => {
      useFakeFrames();
      stubReducedMotion(true);
      render(<App />);
      expect(screen.queryByRole('button', { name: /심완/ })).not.toBeInTheDocument();
      openWithEnter();
      const name = screen.getByRole('button', { name: /^심완/ });
      fireEvent.click(name);
      expect(name).toHaveAttribute('aria-disabled', 'true');
      advance(1000);
      expect(screen.queryByRole('button', { name: /심완/ })).not.toBeInTheDocument();
      expect(folio()).toBeNull();
      expect(openBookButton()).toHaveFocus();
    });

    it('should close the front cover with the previous button on the first spread', () => {
      useFakeFrames();
      stubReducedMotion(false);
      render(<App />);
      const region = openWithEnter();
      fireEvent.click(within(region).getByRole('button', { name: '앞표지 덮기' }));
      // 넘겨주는 동안에는 펼친 책 DOM 위로 3D 책이 들어온다.
      advance(OPEN_HANDOFF_DURATION_MS / 2);
      expect(closedStage()).toHaveAttribute('data-phase', 'closing');
      expect(Number(region.style.getPropertyValue('--chrome-reveal'))).toBeGreaterThan(0);
      advance(3000);
      expect(screen.queryByRole('region', { name: '펼친 책' })).not.toBeInTheDocument();
      expect(closedStage()).toHaveAttribute('data-phase', 'closed');
      expect(folio()).toBeNull();
      expect(screen.getByRole('status')).toHaveTextContent('책을 덮었다, 앞표지');
      expect(openBookButton()).toHaveFocus();
    });

    it('should close the back cover with the next button on the last spread and show the back face', () => {
      useFakeFrames();
      stubReducedMotion(true);
      render(<App />);
      const region = openWithEnter();
      const next = within(region).getByRole('button', { name: '다음 쪽' });
      fireEvent.click(next);
      fireEvent.click(next);
      fireEvent.click(next);
      fireEvent.click(within(region).getByRole('button', { name: '뒤표지 덮기' }));
      advance(1000);
      expect(folio()).toBeNull();
      expect(shownFace()).toBe('back');
      expect(screen.getByRole('status')).toHaveTextContent('책을 덮었다, 뒤표지');
      // 다시 펼치면 앞면으로 돌아와 연다.
      fireEvent.keyDown(openBookButton(), { key: 'Enter' });
      advance(1000);
      expect(folio()).toHaveTextContent('01–02/08');
    });

    it('should close the back cover from the last page on a tall phone screen', () => {
      useFakeFrames();
      stubReducedMotion(true);
      resizeViewport(390, 844);
      render(<App />);
      const region = openWithEnter();
      for (let page = 2; page < 8; page += 1) {
        fireEvent.click(within(region).getByRole('button', { name: '다음 쪽' }));
      }
      expect(folio()).toHaveTextContent('08/08');
      fireEvent.keyDown(region, { key: 'ArrowRight' });
      advance(1000);
      expect(shownFace()).toBe('back');
    });

    it('should close the cover by dragging it over the spine on the first spread', () => {
      useFakeFrames();
      stubReducedMotion(false);
      render(<App />);
      const region = openWithEnter();
      const closeButton = within(region).getByRole('button', { name: '앞표지 덮기' });
      // 1024 × 768 펼침: 왼쪽 쪽 바깥 가장자리는 화면 x = 80. 드래그 시작 영역은 x ≈ 132까지.
      fireEvent.pointerDown(closeButton, { pointerId: 8, button: 0, clientX: 100, clientY: 500 });
      fireEvent.pointerMove(closeButton, { pointerId: 8, buttons: 1, clientX: 140, clientY: 500 });
      expect(region).toHaveAttribute('data-phase', 'closing');
      expect(region).toHaveStyle({ opacity: '0' });
      expect(closedStage()).toHaveAttribute('data-phase', 'closing');
      expect(folio()).toHaveTextContent('01–02/08');
      fireEvent.pointerMove(closeButton, { pointerId: 8, buttons: 1, clientX: 700, clientY: 500 });
      fireEvent.pointerUp(closeButton, { pointerId: 8, clientX: 700, clientY: 500 });
      fireEvent.click(closeButton, { detail: 1 });
      expect(screen.queryByRole('region', { name: '펼친 책' })).not.toBeInTheDocument();
      // 놓아서 덮기가 확정되면 펼친 책이 바로 사라진다. 포커스는 body로 빠지지 않고 닫힌 책 버튼으로 간다.
      expect(openBookButton()).toHaveFocus();
      advance(3000);
      expect(folio()).toBeNull();
      expect(screen.getByRole('status')).toHaveTextContent('책을 덮었다, 앞표지');
    });
  });
});
