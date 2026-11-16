import { describe, expect, it } from 'vitest';

import { DEFAULT_TURN_TIMING } from '@/model/fold';

import type { BookEvent, BookState } from '../book-state';
import {
  createInitialBookState,
  firstVisiblePage,
  folioPages,
  initialView,
  needsFrames,
  needsResync,
  reduceBook,
  sceneForGeometry,
  SINGLE_LAYOUT_FIRST_PAGE,
  turnBaseView,
} from '../book-state';
import type { OpenGeometry } from '../geometry';
import { computeOpenGeometry } from '../geometry';
import { openingDuration, REDUCED_MOTION_CROSSFADE_MS } from '../opening';
import { INITIAL_ROTATION } from '../rotation';

const PAGE_COUNT = 8;
const spread = computeOpenGeometry({ width: 1440, height: 900 }, 'spread');
const smallerSpread = computeOpenGeometry({ width: 1100, height: 700 }, 'spread');
const single = computeOpenGeometry({ width: 390, height: 844 }, 'single');

function run(state: BookState, ...events: BookEvent[]): BookState {
  return events.reduce(reduceBook, state);
}

/** 자동 구간이 끝날 때까지 16ms 간격 프레임을 넣는다. */
function runFrames(state: BookState, geometry: OpenGeometry = spread, startTime = 0, limitMs = 5000): BookState {
  let current = state;
  for (let time = startTime; time <= startTime + limitMs && needsFrames(current.scene); time += 16) {
    current = reduceBook(current, { type: 'frame', time, geometry, reducedMotion: false });
  }
  return current;
}

function openBook(geometry: OpenGeometry = spread, reducedMotion = true): BookState {
  return runFrames(run(createInitialBookState(PAGE_COUNT), { type: 'open', reducedMotion }), geometry);
}

function openSpread(): BookState {
  return openBook(spread);
}

function turnClick(direction: 'forward' | 'backward', reducedMotion: boolean, geometry = spread): BookEvent {
  return { type: 'turn-click', direction, press: null, geometry, reducedMotion };
}

function frame(time: number, geometry: OpenGeometry = spread, reducedMotion = false): BookEvent {
  return { type: 'frame', time, geometry, reducedMotion };
}

describe('book state', () => {
  it('should start closed in the closed-a pose', () => {
    const state = createInitialBookState(PAGE_COUNT);
    expect(state.scene).toEqual({ phase: 'closed', rotation: INITIAL_ROTATION, rotationAnimated: false });
    expect(state.landing).toBeNull();
    expect(folioPages(state.scene)).toBeNull();
    expect(needsFrames(state.scene)).toBe(false);
    expect(turnBaseView(state.scene)).toBeNull();
  });

  describe('closed book', () => {
    it('should follow drag rotation and animate key steps', () => {
      const dragged = run(createInitialBookState(PAGE_COUNT), { type: 'rotate', rotation: { yaw: 40, pitch: 3 } });
      expect(dragged.scene).toEqual({ phase: 'closed', rotation: { yaw: 40, pitch: 3 }, rotationAnimated: false });
      const stepped = run(dragged, { type: 'rotate-step', step: 1 });
      expect(stepped.scene).toEqual({ phase: 'closed', rotation: { yaw: 90, pitch: 3 }, rotationAnimated: true });
    });

    it('should ignore rotation once open', () => {
      const open = openSpread();
      expect(run(open, { type: 'rotate', rotation: { yaw: 1, pitch: 1 } })).toBe(open);
      expect(run(open, { type: 'rotate-step', step: -1 })).toBe(open);
    });

    it('should do nothing on frames and resizes while resting', () => {
      const state = createInitialBookState(PAGE_COUNT);
      expect(run(state, frame(10))).toBe(state);
      expect(run(state, { type: 'resize', geometry: single })).toBe(state);
      expect(needsResync(state.scene, single)).toBe(false);
    });
  });

  describe('opening', () => {
    it('should crossfade with reduced motion and announce the first spread on landing', () => {
      const opening = run(createInitialBookState(PAGE_COUNT), { type: 'open', reducedMotion: true });
      expect(opening.scene).toMatchObject({ phase: 'opening', timeline: { crossfade: true } });
      const started = run(opening, frame(100));
      expect(started.landing).toBeNull();
      const almost = run(started, frame(100 + REDUCED_MOTION_CROSSFADE_MS - 1));
      expect(almost.scene.phase).toBe('opening');
      const landed = run(almost, frame(100 + REDUCED_MOTION_CROSSFADE_MS));
      expect(landed.scene).toEqual({ phase: 'open', view: { layout: 'spread', spread: 0 } });
      expect(landed.landing).toEqual({ serial: 1, pages: [1, 2] });
    });

    it('should start on the page under the cover in the single layout', () => {
      const state = openBook(single);
      expect(state.scene).toEqual({ phase: 'open', view: { layout: 'single', page: SINGLE_LAYOUT_FIRST_PAGE } });
      expect(state.landing?.pages).toEqual([2]);
    });

    it('should play the opening timeline by frame time and then land', () => {
      const opening = run(createInitialBookState(PAGE_COUNT), { type: 'open', reducedMotion: false });
      expect(opening.scene.phase).toBe('opening');
      expect(needsFrames(opening.scene)).toBe(true);
      expect(folioPages(opening.scene)).toBeNull();
      const first = run(opening, frame(500));
      expect(first.scene).toMatchObject({ phase: 'opening', startTime: 500, elapsedMs: 0 });
      const scene = first.scene.phase === 'opening' ? first.scene : null;
      const done = run(first, frame(500 + openingDuration(scene!.timeline)));
      expect(done.scene).toEqual({ phase: 'open', view: { layout: 'spread', spread: 0 } });
      expect(done.landing).toEqual({ serial: 1, pages: [1, 2] });
    });

    it('should land at once when reduced motion is turned on during the opening', () => {
      const first = run(createInitialBookState(PAGE_COUNT), { type: 'open', reducedMotion: false }, frame(0));
      const landed = run(first, frame(16, spread, true));
      expect(landed.scene).toEqual({ phase: 'open', view: { layout: 'spread', spread: 0 } });
      expect(landed.landing?.pages).toEqual([1, 2]);
    });

    it('should ignore a second open request and turn requests while opening', () => {
      const opening = run(createInitialBookState(PAGE_COUNT), { type: 'open', reducedMotion: false });
      expect(run(opening, { type: 'open', reducedMotion: false })).toBe(opening);
      expect(run(opening, turnClick('forward', false))).toBe(opening);
    });
  });

  describe('click turns', () => {
    it('should turn forward over time and announce only on landing', () => {
      const turning = run(openSpread(), turnClick('forward', false));
      expect(turning.scene.phase).toBe('turning');
      expect(turning.landing?.serial).toBe(1);
      expect(folioPages(turning.scene)).toEqual([1, 2]);
      expect(needsFrames(turning.scene)).toBe(true);
      expect(turnBaseView(turning.scene)).toEqual({ layout: 'spread', spread: 1 });
      const landed = runFrames(turning);
      expect(landed.scene).toEqual({ phase: 'open', view: { layout: 'spread', spread: 1 } });
      expect(landed.landing).toEqual({ serial: 2, pages: [3, 4] });
    });

    it('should take the default turn time regardless of frame spacing', () => {
      const turning = run(openSpread(), turnClick('forward', false));
      const started = run(turning, frame(0));
      const almost = run(started, frame(DEFAULT_TURN_TIMING.durationMs - 1));
      expect(almost.scene.phase).toBe('turning');
      const landed = run(almost, frame(DEFAULT_TURN_TIMING.durationMs));
      expect(landed.scene.phase).toBe('open');
    });

    it('should swap at once with reduced motion', () => {
      const state = run(
        openSpread(),
        turnClick('forward', true),
        turnClick('forward', true),
        turnClick('backward', true)
      );
      expect(state.scene).toEqual({ phase: 'open', view: { layout: 'spread', spread: 1 } });
      expect(state.landing).toEqual({ serial: 4, pages: [3, 4] });
    });

    it('should not turn past either end', () => {
      const first = openSpread();
      expect(run(first, turnClick('backward', true))).toBe(first);
      const last = run(first, turnClick('forward', true), turnClick('forward', true), turnClick('forward', true));
      expect(last.scene).toEqual({ phase: 'open', view: { layout: 'spread', spread: 3 } });
      expect(run(last, turnClick('forward', true))).toBe(last);
    });

    it('should land the turning leaf and start the next turn when pressed again', () => {
      const turning = run(openSpread(), turnClick('forward', false), frame(0), frame(200));
      const chained = run(turning, turnClick('forward', false));
      expect(chained.landing).toEqual({ serial: 2, pages: [3, 4] });
      expect(chained.scene).toMatchObject({ phase: 'turning', view: { layout: 'spread', spread: 1 } });
      const landed = runFrames(chained, spread, 1000);
      expect(landed.scene).toEqual({ phase: 'open', view: { layout: 'spread', spread: 2 } });
      expect(landed.landing).toEqual({ serial: 3, pages: [5, 6] });
    });

    it('should not cut a turn short when there is nothing to turn to after it', () => {
      const last = run(openSpread(), turnClick('forward', true), turnClick('forward', true));
      const turning = run(last, turnClick('forward', false), frame(0));
      expect(turnBaseView(turning.scene)).toEqual({ layout: 'spread', spread: 3 });
      expect(run(turning, turnClick('forward', false))).toBe(turning);
    });

    it('should ignore clicks while dragging and while the book is closed', () => {
      const dragging = run(openSpread(), {
        type: 'turn-drag-start',
        direction: 'forward',
        origin: { x: spread.page.width * 2 - 10, y: 500 },
        point: { x: spread.page.width * 2 - 20, y: 500 },
        time: 0,
        geometry: spread,
      });
      expect(turnBaseView(dragging.scene)).toBeNull();
      expect(run(dragging, turnClick('forward', false))).toBe(dragging);
      const closed = createInitialBookState(PAGE_COUNT);
      expect(run(closed, turnClick('forward', false))).toBe(closed);
    });

    it('should land at once when reduced motion is turned on during a turn', () => {
      const turning = run(openSpread(), turnClick('forward', false), frame(0));
      const landed = run(turning, frame(16, spread, true));
      expect(landed.scene).toEqual({ phase: 'open', view: { layout: 'spread', spread: 1 } });
      expect(landed.landing?.pages).toEqual([3, 4]);
    });

    it('should move one page at a time in the single layout', () => {
      const open = openBook(single);
      const next = run(open, turnClick('forward', true, single));
      expect(next.scene).toEqual({ phase: 'open', view: { layout: 'single', page: 3 } });
      const turning = run(next, turnClick('forward', false, single));
      expect(turning.scene.phase === 'turning' && turning.scene.move.turn).toBeNull();
      expect(runFrames(turning, single).scene).toEqual({ phase: 'open', view: { layout: 'single', page: 4 } });
    });
  });

  describe('drag turns', () => {
    // 오른쪽 쪽 바깥 가장자리 근처(책 좌표)에서 눌러 끈다.
    const origin = { x: spread.page.width * 2 - 10, y: 500 };

    function dragStart(state: BookState): BookState {
      return run(state, {
        type: 'turn-drag-start',
        direction: 'forward',
        origin,
        point: { x: origin.x - 10, y: 500 },
        time: 0,
        geometry: spread,
      });
    }

    function dragMove(x: number, time: number): BookEvent {
      return { type: 'turn-drag-move', point: { x, y: 500 }, time, geometry: spread };
    }

    function dragEnd(x: number, time: number, reducedMotion = false): BookEvent {
      return { type: 'turn-drag-end', point: { x, y: 500 }, time, geometry: spread, reducedMotion };
    }

    it('should follow the pointer without frames, then settle and land past the middle', () => {
      const dragging = dragStart(openSpread());
      expect(dragging.scene.phase).toBe('turning');
      expect(needsFrames(dragging.scene)).toBe(false);
      const moved = run(dragging, dragMove(100, 500));
      expect(moved.scene).not.toBe(dragging.scene);
      expect(run(moved, frame(600))).toBe(moved);
      expect(run(moved, frame(600, spread, true))).toBe(moved);
      const released = run(moved, dragEnd(100, 1000));
      expect(needsFrames(released.scene)).toBe(true);
      const landed = runFrames(released, spread, 2000);
      expect(landed.scene).toEqual({ phase: 'open', view: { layout: 'spread', spread: 1 } });
      expect(landed.landing?.pages).toEqual([3, 4]);
    });

    it('should return without announcing when released early', () => {
      const open = openSpread();
      const released = run(dragStart(open), dragMove(origin.x - 60, 500), dragEnd(origin.x - 60, 1000));
      const settled = runFrames(released, spread, 2000);
      expect(settled.scene).toEqual(open.scene);
      expect(settled.landing).toBe(open.landing);
    });

    it('should apply the same release rule at once with reduced motion', () => {
      const open = openSpread();
      const completed = run(dragStart(open), dragMove(100, 500), dragEnd(100, 1000, true));
      expect(completed.scene).toEqual({ phase: 'open', view: { layout: 'spread', spread: 1 } });
      const returned = run(dragStart(open), { type: 'turn-drag-cancel', geometry: spread, reducedMotion: true });
      expect(returned.scene).toEqual(open.scene);
      expect(returned.landing).toBe(open.landing);
    });

    it('should settle back after a cancel with full motion', () => {
      const cancelled = run(dragStart(openSpread()), {
        type: 'turn-drag-cancel',
        geometry: spread,
        reducedMotion: false,
      });
      expect(needsFrames(cancelled.scene)).toBe(true);
      expect(runFrames(cancelled).scene).toEqual({ phase: 'open', view: { layout: 'spread', spread: 0 } });
    });

    it('should land a settling leaf before a new drag starts', () => {
      const settling = run(dragStart(openSpread()), dragMove(100, 500), dragEnd(100, 1000), frame(1000));
      expect(turnBaseView(settling.scene)).toEqual({ layout: 'spread', spread: 1 });
      const next = dragStart(settling);
      expect(next.landing?.pages).toEqual([3, 4]);
      expect(next.scene).toMatchObject({ phase: 'turning', view: { layout: 'spread', spread: 1 } });
    });

    it('should ignore drag moves when no drag is in progress', () => {
      const open = openSpread();
      expect(run(open, dragMove(0, 0))).toBe(open);
      const clicking = run(open, turnClick('forward', false));
      expect(run(clicking, dragEnd(0, 0))).toBe(clicking);
    });
  });

  describe('screen size changes', () => {
    it('should keep the first visible page when switching layouts', () => {
      const scene = { phase: 'open', view: { layout: 'spread', spread: 1 } } as const;
      expect(sceneForGeometry(scene, single)).toEqual({ phase: 'open', view: { layout: 'single', page: 3 } });
      expect(sceneForGeometry(scene, spread)).toBe(scene);
      expect(sceneForGeometry({ phase: 'open', view: { layout: 'single', page: 4 } }, spread)).toEqual({
        phase: 'open',
        view: { layout: 'spread', spread: 1 },
      });
    });

    it('should drop a turning leaf for good when the layout changes and comes back', () => {
      const turning = run(openSpread(), turnClick('forward', false), frame(0));
      expect(needsResync(turning.scene, single)).toBe(true);
      const resized = run(turning, { type: 'resize', geometry: single });
      expect(resized.scene).toEqual({ phase: 'open', view: { layout: 'single', page: 1 } });
      expect(needsFrames(resized.scene)).toBe(false);
      const restored = run(resized, { type: 'resize', geometry: spread });
      expect(restored.scene).toEqual({ phase: 'open', view: { layout: 'spread', spread: 0 } });
      expect(restored.landing).toBe(turning.landing);
    });

    it('should drop a turning leaf when the page size changes in the same layout', () => {
      const turning = run(openSpread(), turnClick('forward', false), frame(0), frame(300));
      expect(needsResync(turning.scene, spread)).toBe(false);
      expect(needsResync(turning.scene, smallerSpread)).toBe(true);
      const resized = run(turning, frame(320, smallerSpread));
      expect(resized.scene).toEqual({ phase: 'open', view: { layout: 'spread', spread: 0 } });
      expect(resized.landing).toBe(turning.landing);
      expect(needsResync(resized.scene, smallerSpread)).toBe(false);
    });

    it('should turn from the remapped view', () => {
      const state = run(openSpread(), turnClick('forward', true, single));
      expect(state.scene).toEqual({ phase: 'open', view: { layout: 'single', page: 2 } });
    });
  });

  it('should expose helpers for views', () => {
    expect(initialView('spread')).toEqual({ layout: 'spread', spread: 0 });
    expect(initialView('single')).toEqual({ layout: 'single', page: SINGLE_LAYOUT_FIRST_PAGE });
    expect(firstVisiblePage({ layout: 'spread', spread: 2 })).toBe(5);
    expect(firstVisiblePage({ layout: 'single', page: 6 })).toBe(6);
  });
});
