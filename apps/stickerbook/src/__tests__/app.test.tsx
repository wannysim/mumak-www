import { act, createEvent, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '@/app';

vi.mock('@/book/turning-page', () => ({ TurningPage: () => <div data-testid="turning-surface" /> }));
let width = 1200;
let height = 700;
let resize: (() => void) | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  width = 1200;
  height = 700;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({
    x: 0,
    y: 70,
    left: 0,
    top: 70,
    width,
    height,
    right: width,
    bottom: height + 70,
    toJSON: () => ({}),
  }));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const next = () => screen.getByRole('button', { name: '다음 페이지' });
const previous = () => screen.getByRole('button', { name: '이전 페이지' });
const book = () => screen.getByRole('region', { name: '사진 스티커북' });
function runTurn() {
  act(() => {
    vi.advanceTimersByTime(800);
  });
}
function pointer(
  target: HTMLElement,
  type: 'pointerDown' | 'pointerMove' | 'pointerUp' | 'pointerCancel' | 'lostPointerCapture',
  x: number,
  time: number,
  id = 1,
  isPrimary = true
) {
  const event = createEvent[type](target, {
    pointerId: id,
    clientX: x,
    clientY: 600,
    button: 0,
    isPrimary,
    bubbles: true,
  });
  Object.defineProperty(event, 'timeStamp', { value: time + 1000 });
  fireEvent(target, event);
}

describe('album reading', () => {
  it('navigates by pointer, enforces boundaries and closes/reopens at the same spread', () => {
    render(<App />);
    expect(previous()).toBeDisabled();
    fireEvent.click(next(), { detail: 1 });
    expect(screen.getByTestId('turning-surface')).toBeInTheDocument();
    runTurn();
    expect(screen.getByText('03 — 04')).toBeInTheDocument();
    fireEvent.click(next(), { detail: 1 });
    runTurn();
    expect(next()).toBeDisabled();
    fireEvent.click(previous(), { detail: 1 });
    runTurn();
    fireEvent.click(screen.getByRole('button', { name: '책 덮기' }));
    expect(next()).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /눌러서 펼치기/ }));
    expect(screen.getByText('03 — 04')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '책 덮기' }));
    fireEvent.click(screen.getByRole('button', { name: '책 펼치기' }));
    expect(next()).toBeEnabled();
  });
  it('keyboard turns instantly and does not capture keys inside a photo button', () => {
    render(<App />);
    fireEvent.keyDown(book(), { key: 'ArrowRight' });
    expect(screen.getByText('03 — 04')).toBeInTheDocument();
    expect(screen.queryByTestId('turning-surface')).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Into the green 사진 크게 보기' }), { key: 'ArrowRight' });
    expect(screen.getByText('03 — 04')).toBeInTheDocument();
    fireEvent.keyDown(book(), { key: 'ArrowLeft' });
    expect(previous()).toBeDisabled();
    fireEvent.keyDown(book(), { key: 'ArrowLeft' });
    fireEvent.keyDown(book(), { key: 'x' });
    expect(previous()).toBeDisabled();
  });
  it('keeps the same spread when resizing between phone and tablet', () => {
    width = 390;
    render(<App />);
    fireEvent.click(next());
    expect(screen.getByRole('navigation', { name: '책 페이지 이동' })).toHaveTextContent('03 — 04');
    width = 1000;
    act(() => resize?.());
    expect(screen.getByText('03 — 04')).toBeInTheDocument();
    width = 390;
    act(() => resize?.());
    expect(screen.getByRole('button', { name: 'Into the green 사진 크게 보기' })).toBeInTheDocument();
  });
  it('does not turn on a compact page pointer-down, but keeps navigation buttons available', () => {
    height = 190;
    render(<App />);
    expect(book()).toHaveAttribute('data-compact', 'true');
    pointer(book(), 'pointerDown', 1180, 0);
    expect(screen.getByRole('button', { name: 'The quiet outside 사진 크게 보기' })).toBeInTheDocument();
    expect(screen.queryByTestId('turning-surface')).not.toBeInTheDocument();
    fireEvent.click(next(), { detail: 1 });
    expect(screen.getByRole('button', { name: 'Into the green 사진 크게 보기' })).toBeInTheDocument();
    expect(screen.queryByTestId('turning-surface')).not.toBeInTheDocument();
  });
  it('cancels a pending animation on rotation', () => {
    render(<App />);
    fireEvent.click(next(), { detail: 1 });
    width = 390;
    act(() => resize?.());
    runTurn();
    expect(screen.getByRole('button', { name: 'The quiet outside 사진 크게 보기' })).toBeInTheDocument();
  });
  it('opens photos and returns focus after closing', () => {
    render(<App />);
    const trigger = screen.getByRole('button', { name: 'The quiet outside 사진 크게 보기' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toHaveTextContent('EXIF 미제공');
    fireEvent.click(screen.getByRole('button', { name: '사진 닫기' }));
    runTurn();
    expect(trigger).toHaveFocus();
  });
  it('help explains prototype assets and restores the help button', () => {
    render(<App />);
    const trigger = screen.getByRole('button', { name: '이용 안내' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toHaveTextContent('임시 여우');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    runTurn();
    expect(trigger).toHaveFocus();
  });
});
describe('separate page and sticker gestures', () => {
  it('commits a sufficiently long drag and ignores additional fingers', () => {
    render(<App />);
    pointer(book(), 'pointerDown', 1180, 0);
    pointer(book(), 'pointerDown', 10, 2, 2, false);
    pointer(book(), 'pointerMove', 100, 20, 2);
    pointer(book(), 'pointerMove', 700, 100);
    pointer(book(), 'pointerUp', 700, 110);
    runTurn();
    expect(screen.getByText('03 — 04')).toBeInTheDocument();
  });
  it('rolls a short gesture back and supports cancel/lost capture/Escape', () => {
    render(<App />);
    pointer(book(), 'pointerDown', 1180, 0);
    pointer(book(), 'pointerMove', 1160, 200);
    pointer(book(), 'pointerUp', 1160, 400);
    runTurn();
    expect(previous()).toBeDisabled();
    pointer(book(), 'pointerDown', 1180, 500);
    pointer(book(), 'pointerMove', 700, 600);
    pointer(book(), 'pointerCancel', 700, 650);
    runTurn();
    expect(previous()).toBeDisabled();
    pointer(book(), 'pointerDown', 1180, 700);
    pointer(book(), 'lostPointerCapture', 1180, 720);
    runTurn();
    expect(previous()).toBeDisabled();
    pointer(book(), 'pointerDown', 1180, 800);
    fireEvent.keyDown(book(), { key: 'Escape' });
    runTurn();
    expect(previous()).toBeDisabled();
  });
  it('moves backward by dragging the left page and handles edge attempts', () => {
    render(<App />);
    pointer(book(), 'pointerDown', 10, 0);
    expect(screen.queryByTestId('turning-surface')).not.toBeInTheDocument();
    fireEvent.click(next());
    pointer(book(), 'pointerDown', 10, 100);
    pointer(book(), 'pointerMove', 490, 200);
    pointer(book(), 'pointerUp', 490, 220);
    runTurn();
    expect(previous()).toBeDisabled();
  });
  it('peels with native click/keyboard alternatives and remembers state across pages', () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: '여우 스티커 떼기' })[0]!);
    expect(screen.getByRole('status')).toHaveTextContent('깨끗하게');
    expect(previous()).toBeDisabled();
    fireEvent.click(next());
    fireEvent.click(previous());
    expect(screen.getByRole('button', { name: '여우 스티커 다시 붙이기' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '여우 스티커 다시 붙이기' }));
    fireEvent.click(screen.getAllByRole('button', { name: '여우 스티커 떼기' })[0]!, { shiftKey: true });
    expect(screen.getByRole('status')).toHaveTextContent('자국');
    fireEvent.click(screen.getByRole('button', { name: '스티커 되돌리기' }));
    expect(screen.getAllByRole('button', { name: '여우 스티커 떼기' })).toHaveLength(5);
  });
  it('keeps each small sticker independent across page turns and resets the entire album', () => {
    render(<App />);
    const pageOne = screen.getByRole('article', { name: '1쪽: The quiet outside' });
    const pageTwo = screen.getByRole('article', { name: '2쪽: A place to pause' });
    expect(within(pageOne).getAllByRole('button', { name: '여우 스티커 떼기' })).toHaveLength(2);
    expect(within(pageTwo).getAllByRole('button', { name: '여우 스티커 떼기' })).toHaveLength(3);
    fireEvent.click(within(pageOne).getAllByRole('button', { name: '여우 스티커 떼기' })[0]!);
    fireEvent.click(within(pageTwo).getAllByRole('button', { name: '여우 스티커 떼기' })[1]!, { shiftKey: true });
    expect(pageOne.querySelector('[data-sticker-state="clean"]')).not.toBeNull();
    expect(pageTwo.querySelector('[data-sticker-state="residue"]')).not.toBeNull();
    expect(screen.getAllByRole('button', { name: '여우 스티커 떼기' })).toHaveLength(3);
    fireEvent.click(next());
    expect(screen.queryByRole('button', { name: '여우 스티커 다시 붙이기' })).not.toBeInTheDocument();
    fireEvent.click(previous());
    expect(screen.getAllByRole('button', { name: '여우 스티커 다시 붙이기' })).toHaveLength(2);
    fireEvent.click(next());
    fireEvent.click(screen.getByRole('button', { name: '스티커 되돌리기' }));
    fireEvent.click(previous());
    expect(screen.getAllByRole('button', { name: '여우 스티커 떼기' })).toHaveLength(5);
  });
  it('desk props react independently from navigation', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '커피잔 움직이기' }));
    expect(screen.getByRole('status')).toHaveTextContent('커피 한 모금');
    fireEvent.click(screen.getByRole('button', { name: '커피잔 움직이기' }));
    expect(screen.getByRole('status')).toHaveTextContent('제자리');
    fireEvent.click(screen.getByRole('button', { name: '카메라 셔터 누르기' }));
    expect(screen.getByRole('status')).toHaveTextContent('찰칵');
    fireEvent.click(screen.getByRole('button', { name: '연필 굴리기' }));
    expect(screen.getByRole('status')).toHaveTextContent('데굴');
    expect(within(book()).getByRole('heading', { name: 'The quiet outside' })).toBeInTheDocument();
  });
});
