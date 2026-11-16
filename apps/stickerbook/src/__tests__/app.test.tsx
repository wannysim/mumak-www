import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { App } from '@/app';
import { OPEN_HANDOFF_DURATION_MS, REDUCED_MOTION_CROSSFADE_MS } from '@/model/book/opening';
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

function openWithEnter() {
  fireEvent.keyDown(openBookButton(), { key: 'Enter' });
  advance(2000);
  return bookRegion();
}

describe('App', () => {
  it('should show the closed book with its cover described for screen readers', () => {
    stubReducedMotion(true);
    render(<App />);
    expect(screen.getByRole('main', { name: 'Stickerbook' })).toBeInTheDocument();
    const button = openBookButton();
    expect(button).toHaveAccessibleDescription(/앞표지: 심완, 사진 찍는 개발자\. 뒤표지: example@mail\.com/);
    expect(folio()).toHaveTextContent('앞표지');
    expect(screen.queryByRole('region', { name: '펼친 책' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('should turn the closed book with the arrow keys', () => {
    stubReducedMotion(true);
    render(<App />);
    fireEvent.keyDown(openBookButton(), { key: 'ArrowRight' });
    expect(folio()).toHaveTextContent('책등');
    fireEvent.keyDown(openBookButton(), { key: 'ArrowLeft' });
    fireEvent.keyDown(openBookButton(), { key: 'ArrowLeft' });
    expect(folio()).toHaveTextContent('책배');
    fireEvent.keyDown(openBookButton(), { key: 'Tab' });
    expect(openBookButton()).toBeInTheDocument();
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

  it('should turn with the next button and the arrow keys, and stop at both ends', () => {
    useFakeFrames();
    stubReducedMotion(true);
    render(<App />);
    const region = openWithEnter();
    const previous = within(region).getByRole('button', { name: '이전 쪽' });
    const next = within(region).getByRole('button', { name: '다음 쪽' });
    expect(previous).toHaveAttribute('aria-disabled', 'true');
    expect(next).not.toHaveAttribute('aria-disabled');

    fireEvent.click(next);
    expect(screen.getByRole('status')).toHaveTextContent('03–04쪽');
    expect(folio()).toHaveTextContent('03–04/08');
    expect(previous).not.toHaveAttribute('aria-disabled');

    fireEvent.keyDown(region, { key: 'ArrowRight' });
    fireEvent.keyDown(next, { key: 'ArrowRight' });
    expect(folio()).toHaveTextContent('07–08/08');
    expect(next).toHaveAttribute('aria-disabled', 'true');
    expect(within(region).getByText('판권면 · 임시')).toBeInTheDocument();

    fireEvent.click(next);
    expect(folio()).toHaveTextContent('07–08/08');

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

  it('should name the face the book actually shows while it turns back to open', () => {
    useFakeFrames();
    stubReducedMotion(false);
    render(<App />);
    fireEvent.keyDown(openBookButton(), { key: 'ArrowRight' });
    fireEvent.keyDown(openBookButton(), { key: 'ArrowRight' });
    expect(folio()).toHaveTextContent('뒤표지');
    fireEvent.keyDown(openBookButton(), { key: 'Enter' });
    advance(50);
    expect(folio()).toHaveTextContent('뒤표지');
    advance(650);
    expect(folio()).toHaveTextContent('앞표지');
  });

  it('should follow prefers-reduced-motion changes, even in the middle of the opening', () => {
    useFakeFrames();
    const motion = stubReducedMotion(false);
    render(<App />);
    fireEvent.keyDown(openBookButton(), { key: 'ArrowRight' });
    expect(document.querySelector('.closed-book')).toHaveAttribute('data-animated', 'true');
    motion.set(true);
    expect(document.querySelector('.closed-book')).toHaveAttribute('data-animated', 'false');
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

  it('should rotate on drag and not open on the click that ends the drag', () => {
    useFakeFrames();
    stubReducedMotion(true);
    render(<App />);
    const button = openBookButton();
    fireEvent.pointerDown(button, { pointerId: 1, button: 0, clientX: 500, clientY: 400 });
    fireEvent.pointerMove(button, { pointerId: 1, buttons: 1, clientX: 600, clientY: 400 });
    fireEvent.pointerMove(button, { pointerId: 1, buttons: 1, clientX: 800, clientY: 400 });
    fireEvent.pointerUp(button, { pointerId: 1, clientX: 800, clientY: 400 });
    fireEvent.click(button, { detail: 1 });
    expect(folio()).toHaveTextContent('책등');
    advance(500);
    expect(screen.queryByRole('region', { name: '펼친 책' })).not.toBeInTheDocument();

    fireEvent.pointerDown(button, { pointerId: 2, button: 0, clientX: 512, clientY: 400 });
    fireEvent.pointerUp(button, { pointerId: 2, clientX: 514, clientY: 400 });
    fireEvent.click(button, { detail: 1 });
    advance(500);
    expect(bookRegion()).toBeInTheDocument();
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
});
