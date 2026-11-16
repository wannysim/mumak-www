import { describe, expect, it } from 'vitest';

import { DEFAULT_TURN_TIMING } from '@/model/fold';
import { facingFace } from '@/test/book-faces';

import type { BookEvent, BookScene, BookState } from '../book-state';
import {
  canClose,
  closingSideAt,
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
import { closingDuration } from '../closing';
import type { OpenGeometry } from '../geometry';
import { computeOpenGeometry } from '../geometry';
import { openingDuration, REDUCED_MOTION_CROSSFADE_MS } from '../opening';
import type { Quat } from '../quaternion';
import { angleBetweenQuat, dotQuat } from '../quaternion';
import { INITIAL_ORIENTATION, restOrientation, rotateByDrag } from '../rotation';

const PAGE_COUNT = 8;
const spread = computeOpenGeometry({ width: 1440, height: 900 }, 'spread');
const smallerSpread = computeOpenGeometry({ width: 1100, height: 700 }, 'spread');
const single = computeOpenGeometry({ width: 390, height: 844 }, 'single');

function announcedPages(state: BookState): readonly number[] | undefined {
  return state.announcement?.kind === 'pages' ? state.announcement.pages : undefined;
}

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
    expect(state.scene).toEqual({ phase: 'closed', orientation: INITIAL_ORIENTATION, motion: { type: 'rest' } });
    expect(state.announcement).toBeNull();
    expect(folioPages(state.scene)).toBeNull();
    expect(needsFrames(state.scene)).toBe(false);
    expect(turnBaseView(state.scene)).toBeNull();
  });

  describe('closed book', () => {
    it('should ignore rotation once open', () => {
      const open = openSpread();
      expect(run(open, { type: 'spin-drag', delta: { x: 10, y: 0 } })).toBe(open);
      expect(run(open, { type: 'spin-grab' })).toBe(open);
      expect(run(open, { type: 'key-spin', direction: { x: 1, y: 0 }, reducedMotion: true })).toBe(open);
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
      expect(started.announcement).toBeNull();
      const almost = run(started, frame(100 + REDUCED_MOTION_CROSSFADE_MS - 1));
      expect(almost.scene.phase).toBe('opening');
      const landed = run(almost, frame(100 + REDUCED_MOTION_CROSSFADE_MS));
      expect(landed.scene).toEqual({ phase: 'open', view: { layout: 'spread', spread: 0 } });
      expect(landed.announcement).toEqual({ serial: 1, kind: 'pages', pages: [1, 2] });
    });

    it('should start on the page under the cover in the single layout', () => {
      const state = openBook(single);
      expect(state.scene).toEqual({ phase: 'open', view: { layout: 'single', page: SINGLE_LAYOUT_FIRST_PAGE } });
      expect(announcedPages(state)).toEqual([2]);
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
      expect(done.announcement).toEqual({ serial: 1, kind: 'pages', pages: [1, 2] });
    });

    it('should land at once when reduced motion is turned on during the opening', () => {
      const first = run(createInitialBookState(PAGE_COUNT), { type: 'open', reducedMotion: false }, frame(0));
      const landed = run(first, frame(16, spread, true));
      expect(landed.scene).toEqual({ phase: 'open', view: { layout: 'spread', spread: 0 } });
      expect(announcedPages(landed)).toEqual([1, 2]);
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
      expect(turning.announcement?.serial).toBe(1);
      expect(folioPages(turning.scene)).toEqual([1, 2]);
      expect(needsFrames(turning.scene)).toBe(true);
      expect(turnBaseView(turning.scene)).toEqual({ layout: 'spread', spread: 1 });
      const landed = runFrames(turning);
      expect(landed.scene).toEqual({ phase: 'open', view: { layout: 'spread', spread: 1 } });
      expect(landed.announcement).toEqual({ serial: 2, kind: 'pages', pages: [3, 4] });
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
      expect(state.announcement).toEqual({ serial: 4, kind: 'pages', pages: [3, 4] });
    });

    it('should close the cover instead of turning past either end', () => {
      const first = openSpread();
      expect(run(first, turnClick('backward', false)).scene).toMatchObject({ phase: 'closing', side: 'front' });
      const last = run(first, turnClick('forward', true), turnClick('forward', true), turnClick('forward', true));
      expect(last.scene).toEqual({ phase: 'open', view: { layout: 'spread', spread: 3 } });
      expect(run(last, turnClick('forward', false)).scene).toMatchObject({ phase: 'closing', side: 'back' });
    });

    it('should land the turning leaf and start the next turn when pressed again', () => {
      const turning = run(openSpread(), turnClick('forward', false), frame(0), frame(200));
      const chained = run(turning, turnClick('forward', false));
      expect(chained.announcement).toEqual({ serial: 2, kind: 'pages', pages: [3, 4] });
      expect(chained.scene).toMatchObject({ phase: 'turning', view: { layout: 'spread', spread: 1 } });
      const landed = runFrames(chained, spread, 1000);
      expect(landed.scene).toEqual({ phase: 'open', view: { layout: 'spread', spread: 2 } });
      expect(landed.announcement).toEqual({ serial: 3, kind: 'pages', pages: [5, 6] });
    });

    it('should land the leaf turning to the last spread, then close the back cover from there', () => {
      const last = run(openSpread(), turnClick('forward', true), turnClick('forward', true));
      const turning = run(last, turnClick('forward', false), frame(0));
      expect(turnBaseView(turning.scene)).toEqual({ layout: 'spread', spread: 3 });
      const closing = run(turning, turnClick('forward', false));
      expect(closing.scene).toMatchObject({ phase: 'closing', side: 'back', view: { layout: 'spread', spread: 3 } });
      expect(announcedPages(closing)).toEqual([7, 8]);
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
      expect(announcedPages(landed)).toEqual([3, 4]);
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
      expect(announcedPages(landed)).toEqual([3, 4]);
    });

    it('should return without announcing when released early', () => {
      const open = openSpread();
      const released = run(dragStart(open), dragMove(origin.x - 60, 500), dragEnd(origin.x - 60, 1000));
      const settled = runFrames(released, spread, 2000);
      expect(settled.scene).toEqual(open.scene);
      expect(settled.announcement).toBe(open.announcement);
    });

    it('should apply the same release rule at once with reduced motion', () => {
      const open = openSpread();
      const completed = run(dragStart(open), dragMove(100, 500), dragEnd(100, 1000, true));
      expect(completed.scene).toEqual({ phase: 'open', view: { layout: 'spread', spread: 1 } });
      const returned = run(dragStart(open), { type: 'turn-drag-cancel', geometry: spread, reducedMotion: true });
      expect(returned.scene).toEqual(open.scene);
      expect(returned.announcement).toBe(open.announcement);
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
      expect(announcedPages(next)).toEqual([3, 4]);
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
      expect(restored.announcement).toBe(turning.announcement);
    });

    it('should drop a turning leaf when the page size changes in the same layout', () => {
      const turning = run(openSpread(), turnClick('forward', false), frame(0), frame(300));
      expect(needsResync(turning.scene, spread)).toBe(false);
      expect(needsResync(turning.scene, smallerSpread)).toBe(true);
      const resized = run(turning, frame(320, smallerSpread));
      expect(resized.scene).toEqual({ phase: 'open', view: { layout: 'spread', spread: 0 } });
      expect(resized.announcement).toBe(turning.announcement);
      expect(needsResync(resized.scene, smallerSpread)).toBe(false);
    });

    it('should turn from the remapped view', () => {
      const state = run(openSpread(), turnClick('forward', true, single));
      expect(state.scene).toEqual({ phase: 'open', view: { layout: 'single', page: 2 } });
    });
  });

  describe('closed book motion', () => {
    const closed = createInitialBookState(PAGE_COUNT);

    function orientationOf(state: BookState): Quat {
      if (state.scene.phase !== 'closed') {
        throw new Error('closed expected');
      }
      return state.scene.orientation;
    }

    function expectSameRotation(actual: Quat, expected: Quat) {
      expect(Math.abs(dotQuat(actual, expected))).toBeCloseTo(1, 9);
    }

    function release(velocityX: number, reducedMotion = false): BookEvent {
      return { type: 'spin-release', delta: { x: 0, y: 0 }, velocity: { x: velocityX, y: 0 }, reducedMotion };
    }

    /** 누르고 있는 화살표 방향(합). (0, 0)은 다 뗀 것이다. */
    function hold(x: number, y: number, reducedMotion = false): BookEvent {
      return { type: 'key-spin', direction: { x, y }, reducedMotion };
    }

    function keySpinOf(state: BookState) {
      if (state.scene.phase !== 'closed' || state.scene.motion.type !== 'key') {
        throw new Error('key spin expected');
      }
      return state.scene.motion.spin;
    }

    it('should rotate on screen axes while dragging and do nothing on a grab at rest', () => {
      expect(run(closed, { type: 'spin-grab' })).toBe(closed);
      const dragged = run(
        closed,
        { type: 'spin-drag', delta: { x: 0, y: -400 } },
        { type: 'spin-drag', delta: { x: 10, y: 0 } }
      );
      expectSameRotation(
        orientationOf(dragged),
        rotateByDrag(rotateByDrag(INITIAL_ORIENTATION, { x: 0, y: -400 }), { x: 10, y: 0 })
      );
      expect(needsFrames(dragged.scene)).toBe(false);
      expect(facingFace(orientationOf(dragged))).not.toBe('front');
    });

    it('should keep spinning after a flick, by frame time, and then rest', () => {
      const spinning = run(closed, release(1));
      expect(spinning.scene).toMatchObject({ motion: { type: 'spin' } });
      expect(needsFrames(spinning.scene)).toBe(true);
      const first = run(spinning, frame(100));
      expect(orientationOf(first)).toEqual(INITIAL_ORIENTATION);
      const later = run(first, frame(400));
      expect(dotQuat(orientationOf(later), INITIAL_ORIENTATION)).toBeLessThan(0.99);
      const rested = runFrames(later, spread, 400);
      expect(rested.scene).toMatchObject({ motion: { type: 'rest' } });
      expect(needsFrames(rested.scene)).toBe(false);
    });

    it.each([1000 / 120, 1000 / 60, 1000 / 30])('should spin to the same pose with frames every %f ms', dtMs => {
      let state = run(closed, release(1.5), frame(0));
      for (let time = dtMs; time < 600 - 1e-6; time += dtMs) {
        state = run(state, frame(time));
      }
      state = run(state, frame(600));
      const reference = run(closed, release(1.5), frame(0), frame(600));
      expectSameRotation(orientationOf(state), orientationOf(reference));
      expect(state.scene).toMatchObject({ motion: { type: 'spin' } });
    });

    it('should stop where it is on a grab or when reduced motion turns on, and not spin with reduced motion', () => {
      const spinning = run(closed, release(1), frame(0), frame(200));
      const grabbed = run(spinning, { type: 'spin-grab' });
      expect(grabbed.scene).toEqual({
        phase: 'closed',
        orientation: orientationOf(spinning),
        motion: { type: 'rest' },
      });
      const reduced = run(spinning, frame(216, spread, true));
      expect(reduced.scene).toEqual({
        phase: 'closed',
        orientation: orientationOf(spinning),
        motion: { type: 'rest' },
      });
      expect(run(closed, release(1, true)).scene).toMatchObject({ motion: { type: 'rest' } });
      expect(run(closed, release(0.001)).scene).toMatchObject({ motion: { type: 'rest' } });
    });

    it('should keep turning slowly while an arrow is held and coast to a stop after release', () => {
      const holding = run(closed, hold(1, 0));
      expect(holding.scene).toMatchObject({ motion: { type: 'key' } });
      expect(needsFrames(holding.scene)).toBe(true);
      // 출발은 부드럽다: 처음 200ms는 일정 빠르기(60°/s)로 돈 12°보다 덜 돈다.
      const early = run(holding, frame(0), frame(200));
      expect(angleBetweenQuat(orientationOf(early), INITIAL_ORIENTATION)).toBeLessThan(12 / 2);
      // 1.8초쯤 누르고 있으면 약 90° 돌아 책등이 정면에 온다. 누르는 동안은 서지 않는다.
      const turned = run(holding, frame(0), frame(1800));
      expect(facingFace(orientationOf(turned))).toBe('spine');
      expect(turned.scene).toMatchObject({ motion: { type: 'key' } });
      // 다 떼면 그 빠르기로 관성에 넘겨 조금 더 돌다 선다.
      const released = run(turned, hold(0, 0));
      expect(released.scene).toMatchObject({ motion: { type: 'spin' } });
      expect(orientationOf(released)).toBe(orientationOf(turned));
      const rested = runFrames(released, spread, 1800);
      expect(rested.scene).toMatchObject({ motion: { type: 'rest' } });
      const coast = angleBetweenQuat(orientationOf(rested), orientationOf(turned));
      expect(coast).toBeGreaterThan(5);
      expect(coast).toBeLessThan(20);
    });

    it('should turn at the same speed diagonally', () => {
      const straight = run(closed, hold(1, 0), frame(0), frame(1000));
      const diagonal = run(closed, hold(1, 1), frame(0), frame(1000));
      expect(angleBetweenQuat(orientationOf(diagonal), INITIAL_ORIENTATION)).toBeCloseTo(
        angleBetweenQuat(orientationOf(straight), INITIAL_ORIENTATION),
        0
      );
    });

    it('should carry on from the current speed when the arrows change or while coasting', () => {
      // 오른쪽으로 돌다가 아래 화살표를 더하면 지금 자세와 빠르기에서 이어 간다(자세가 튀지 않는다).
      const right = run(closed, hold(1, 0), frame(0), frame(500));
      const both = run(right, hold(1, 1));
      expect(orientationOf(both)).toBe(orientationOf(right));
      expect(keySpinOf(both).initial.x).toBeCloseTo(0.06 * (1 - Math.exp(-500 / 250)));
      expect(keySpinOf(both).lastTime).toBe(500);
      // 끌어서 던진 관성 중에 누르면 그 관성 빠르기(1px/ms × 0.4°/px × e^(-100/250))에서 이어 간다.
      const coasting = run(closed, release(1), frame(0), frame(100));
      const pressed = run(coasting, hold(1, 0));
      expect(orientationOf(pressed)).toBe(orientationOf(coasting));
      expect(keySpinOf(pressed).initial.x).toBeCloseTo(0.4 * Math.exp(-100 / 250));
    });

    it.each([1000 / 120, 1000 / 60, 1000 / 30])('should hold-turn to the same pose with frames every %f ms', dtMs => {
      let state = run(closed, hold(1, 1), frame(0));
      for (let time = dtMs; time < 900 - 1e-6; time += dtMs) {
        state = run(state, frame(time));
      }
      state = run(state, frame(900));
      expectSameRotation(orientationOf(state), orientationOf(run(closed, hold(1, 1), frame(0), frame(900))));
      expect(state.scene).toMatchObject({ motion: { type: 'key' } });
    });

    it('should turn only while held, without easing, with reduced motion', () => {
      const holding = run(closed, hold(0, -1, true), frame(0), frame(1000));
      // 가속 없이 60°/s.
      expect(angleBetweenQuat(orientationOf(holding), INITIAL_ORIENTATION)).toBeCloseTo(60, 6);
      const released = run(holding, hold(0, 0, true));
      expect(released.scene).toEqual({
        phase: 'closed',
        orientation: orientationOf(holding),
        motion: { type: 'rest' },
      });
      // 누르자마자 떼면(그린 프레임이 없으면) 돌 빠르기가 없어 그 자리에 선다.
      expect(run(closed, hold(1, 0), hold(0, 0)).scene).toMatchObject({ motion: { type: 'rest' } });
      // 누르는 중에 붙잡으면 선다.
      expect(run(holding, { type: 'spin-grab' }).scene).toMatchObject({ motion: { type: 'rest' } });
    });

    it('should open from the pose the book was spun to', () => {
      const spun = run(closed, { type: 'spin-drag', delta: { x: 300, y: 0 } });
      const opening = run(spun, { type: 'open', reducedMotion: false });
      expect(opening.scene.phase === 'opening' && opening.scene.timeline.from).toEqual(orientationOf(spun));
    });
  });

  describe('closing', () => {
    function close(reducedMotion = false, geometry = spread): BookEvent {
      return { type: 'close', side: 'front', geometry, reducedMotion };
    }

    function closedFace(state: BookState): string | null {
      return state.scene.phase === 'closed' ? facingFace(state.scene.orientation) : null;
    }

    function stageOf(scene: BookScene): string | null {
      return scene.phase === 'closing' ? scene.stage.type : null;
    }

    it('should play the opening backwards to the front cover, then announce once and rest in the first pose', () => {
      const open = openSpread();
      const closing = run(open, close());
      expect(closing.scene).toMatchObject({ phase: 'closing', side: 'front', view: { layout: 'spread', spread: 0 } });
      expect(stageOf(closing.scene)).toBe('transition');
      expect(needsFrames(closing.scene)).toBe(true);
      expect(folioPages(closing.scene)).toBeNull();
      const started = run(closing, frame(0));
      const scene =
        started.scene.phase === 'closing' && started.scene.stage.type === 'transition' ? started.scene : null;
      const duration = closingDuration(scene!.stage.type === 'transition' ? scene!.stage.timeline : (null as never));
      const almost = run(started, frame(duration - 1));
      expect(almost.scene.phase).toBe('closing');
      const closed = run(almost, frame(duration));
      expect(closed.scene).toEqual({
        phase: 'closed',
        orientation: restOrientation('front'),
        motion: { type: 'rest' },
      });
      expect(closed.announcement).toEqual({ serial: 2, kind: 'closed', side: 'front' });
      expect(needsFrames(closed.scene)).toBe(false);
    });

    it('should close to the front from a middle spread with Esc and keep that spread for the 3D book', () => {
      const middle = run(openSpread(), turnClick('forward', true), turnClick('forward', true));
      const closing = run(middle, close());
      expect(closing.scene).toMatchObject({ phase: 'closing', side: 'front', view: { layout: 'spread', spread: 2 } });
      expect(closedFace(runFrames(closing))).toBe('front');
    });

    it('should close the back cover forward from the last spread and rest showing the back', () => {
      const last = run(
        openSpread(),
        turnClick('forward', true),
        turnClick('forward', true),
        turnClick('forward', true)
      );
      const closed = runFrames(run(last, turnClick('forward', false)));
      expect(closedFace(closed)).toBe('back');
      expect(closed.announcement).toMatchObject({ kind: 'closed', side: 'back' });
    });

    it('should close at the ends of the single layout too', () => {
      const first = run(openBook(single), turnClick('backward', true, single));
      expect(first.scene).toEqual({ phase: 'open', view: { layout: 'single', page: 1 } });
      expect(run(first, turnClick('backward', false, single)).scene).toMatchObject({ phase: 'closing', side: 'front' });
      let last = first;
      for (let page = 1; page < PAGE_COUNT; page += 1) {
        last = run(last, turnClick('forward', true, single));
      }
      expect(last.scene).toEqual({ phase: 'open', view: { layout: 'single', page: 8 } });
      const closed = runFrames(run(last, turnClick('forward', false, single)), single);
      expect(closedFace(closed)).toBe('back');
    });

    it('should only crossfade with reduced motion, and finish at once when reduced motion turns on mid-close', () => {
      const closing = run(openSpread(), close(true));
      const almost = run(closing, frame(0), frame(REDUCED_MOTION_CROSSFADE_MS - 1));
      expect(almost.scene.phase).toBe('closing');
      expect(run(almost, frame(REDUCED_MOTION_CROSSFADE_MS)).scene.phase).toBe('closed');
      const moving = run(openSpread(), close(false), frame(0), frame(100));
      expect(run(moving, frame(116, spread, true)).scene.phase).toBe('closed');
    });

    it('should ignore every other input while the closing transition plays', () => {
      const closing = run(openSpread(), close(), frame(0), frame(50));
      for (const event of [
        turnClick('forward', false),
        turnClick('backward', false),
        close(),
        { type: 'open', reducedMotion: false } as const,
        { type: 'spin-drag', delta: { x: 10, y: 0 } } as const,
        { type: 'turn-drag-move', point: { x: 0, y: 0 }, time: 0, geometry: spread } as const,
        { type: 'turn-drag-cancel', geometry: spread, reducedMotion: false } as const,
      ]) {
        expect(run(closing, event)).toBe(closing);
      }
      expect(canClose(closing.scene)).toBe(false);
    });

    it('should ignore Esc while opening and while a page or the cover is held by the finger', () => {
      const opening = run(createInitialBookState(PAGE_COUNT), { type: 'open', reducedMotion: false }, frame(0));
      expect(run(opening, close())).toBe(opening);
      expect(canClose(opening.scene)).toBe(false);
      expect(canClose(createInitialBookState(PAGE_COUNT).scene)).toBe(false);
      const dragging = run(openSpread(), {
        type: 'turn-drag-start',
        direction: 'forward',
        origin: { x: spread.page.width * 2 - 10, y: 500 },
        point: { x: spread.page.width * 2 - 30, y: 500 },
        time: 0,
        geometry: spread,
      });
      expect(run(dragging, close())).toBe(dragging);
    });

    it('should land a settling leaf and close from where it landed when Esc comes mid-turn', () => {
      const turning = run(openSpread(), turnClick('forward', false), frame(0), frame(200));
      expect(canClose(turning.scene)).toBe(true);
      const closing = run(turning, close());
      expect(announcedPages(closing)).toEqual([3, 4]);
      expect(closing.scene).toMatchObject({ phase: 'closing', view: { layout: 'spread', spread: 1 } });
    });

    it('should name the ends where turning closes a cover', () => {
      expect(closingSideAt({ layout: 'spread', spread: 0 }, 'backward', PAGE_COUNT)).toBe('front');
      expect(closingSideAt({ layout: 'spread', spread: 0 }, 'forward', PAGE_COUNT)).toBeNull();
      expect(closingSideAt({ layout: 'spread', spread: 3 }, 'forward', PAGE_COUNT)).toBe('back');
      expect(closingSideAt({ layout: 'single', page: 2 }, 'backward', PAGE_COUNT)).toBeNull();
      expect(closingSideAt({ layout: 'single', page: 1 }, 'backward', PAGE_COUNT)).toBe('front');
    });

    describe('by dragging the cover', () => {
      const width = spread.page.width;
      // 첫 펼침 왼쪽 쪽 바깥 가장자리 근처(책 좌표)를 잡아 오른쪽(책등 너머)으로 끈다.
      const origin = { x: 10, y: 500 };

      function dragStart(state: BookState = openSpread()): BookState {
        return run(state, {
          type: 'turn-drag-start',
          direction: 'backward',
          origin,
          point: { x: 30, y: 500 },
          time: 0,
          geometry: spread,
        });
      }

      function dragMove(x: number, time: number, geometry = spread): BookEvent {
        return { type: 'turn-drag-move', point: { x, y: 500 }, time, geometry };
      }

      function dragEnd(x: number, time: number, reducedMotion = false): BookEvent {
        return { type: 'turn-drag-end', point: { x, y: 500 }, time, geometry: spread, reducedMotion };
      }

      it('should follow the finger without frames and keep the page folio while held', () => {
        const dragging = dragStart();
        expect(dragging.scene).toMatchObject({ phase: 'closing', side: 'front', stage: { type: 'drag' } });
        expect(needsFrames(dragging.scene)).toBe(false);
        expect(folioPages(dragging.scene)).toEqual([1, 2]);
        expect(canClose(dragging.scene)).toBe(false);
        expect(turnBaseView(dragging.scene)).toBeNull();
        const moved = run(dragging, dragMove(width, 500));
        expect(moved.scene).not.toBe(dragging.scene);
        expect(run(moved, frame(600))).toBe(moved);
        expect(run(moved, turnClick('forward', false))).toBe(moved);
      });

      it('should finish closing from the released angle past the middle, without a handover', () => {
        const released = run(dragStart(), dragMove(width * 1.4, 500), dragEnd(width * 1.4, 1000));
        expect(stageOf(released.scene)).toBe('transition');
        const timeline =
          released.scene.phase === 'closing' && released.scene.stage.type === 'transition'
            ? released.scene.stage.timeline
            : null;
        expect(timeline?.handoffMs).toBe(0);
        expect(timeline?.fromCoverOpen).toBeGreaterThan(0);
        expect(timeline?.fromCoverOpen).toBeLessThan(0.5);
        const closed = runFrames(released, spread, 2000);
        expect(closedFace(closed)).toBe('front');
        expect(closed.announcement).toMatchObject({ kind: 'closed', side: 'front' });
      });

      it('should reopen without announcing when released early or cancelled', () => {
        const open = openSpread();
        const released = run(dragStart(open), dragMove(width * 0.5, 500), dragEnd(width * 0.5, 1000));
        expect(stageOf(released.scene)).toBe('return');
        expect(needsFrames(released.scene)).toBe(true);
        expect(folioPages(released.scene)).toEqual([1, 2]);
        const settled = runFrames(released, spread, 2000);
        expect(settled.scene).toEqual(open.scene);
        expect(settled.announcement).toBe(open.announcement);
        const cancelled = run(dragStart(open), dragMove(width * 1.4, 500), {
          type: 'turn-drag-cancel',
          geometry: spread,
          reducedMotion: false,
        });
        expect(stageOf(cancelled.scene)).toBe('return');
      });

      it('should apply the same release rule at once with reduced motion', () => {
        const open = openSpread();
        const closed = run(dragStart(open), dragMove(width * 1.4, 500), dragEnd(width * 1.4, 1000, true));
        expect(closedFace(closed)).toBe('front');
        const reopened = run(dragStart(open), dragMove(width * 0.5, 500), dragEnd(width * 0.5, 1000, true));
        expect(reopened.scene).toEqual(open.scene);
        const returning = run(dragStart(open), dragMove(width * 0.5, 500), dragEnd(width * 0.5, 1000), frame(0));
        expect(run(returning, frame(16, spread, true)).scene).toEqual(open.scene);
      });

      it('should end the return at once for a new turn and re-close from the returning angle for a close', () => {
        const returning = run(
          dragStart(),
          dragMove(width * 0.6, 500),
          dragEnd(width * 0.6, 1000),
          frame(0),
          frame(100)
        );
        expect(canClose(returning.scene)).toBe(true);
        expect(turnBaseView(returning.scene)).toEqual({ layout: 'spread', spread: 0 });
        const turned = run(returning, turnClick('forward', true));
        expect(turned.scene).toEqual({ phase: 'open', view: { layout: 'spread', spread: 1 } });
        const reclosing = run(returning, close());
        const timeline =
          reclosing.scene.phase === 'closing' && reclosing.scene.stage.type === 'transition'
            ? reclosing.scene.stage.timeline
            : null;
        expect(timeline?.handoffMs).toBe(0);
        expect(timeline?.fromCoverOpen).toBeGreaterThan(0.5);
        expect(timeline?.fromCoverOpen).toBeLessThan(1);
        const backDrag = run(returning, turnClick('backward', false));
        expect(stageOf(backDrag.scene)).toBe('transition');
      });

      it('should drop a held or returning cover when the layout or page size changes, but finish a committed close', () => {
        const dragging = run(dragStart(), dragMove(width, 500));
        expect(needsResync(dragging.scene, single)).toBe(true);
        expect(run(dragging, { type: 'resize', geometry: single }).scene).toEqual({
          phase: 'open',
          view: { layout: 'single', page: 1 },
        });
        expect(run(dragging, { type: 'resize', geometry: smallerSpread }).scene).toEqual({
          phase: 'open',
          view: { layout: 'spread', spread: 0 },
        });
        // 다른 크기로 온 move는 덮기를 버린 뒤라 아무것도 하지 않는다.
        expect(run(dragging, dragMove(width * 2, 600, smallerSpread)).scene.phase).toBe('open');
        // 손가락이 책등에 닿으면 덮인 정도 0.5라 완주다. 그 앞에서 놓아 되돌아가게 한다.
        const returning = run(dragging, dragEnd(width * 0.6, 1000));
        expect(stageOf(returning.scene)).toBe('return');
        expect(run(returning, { type: 'resize', geometry: smallerSpread }).scene.phase).toBe('open');

        const committed = run(openSpread(), close(), frame(0), frame(300));
        expect(needsResync(committed.scene, smallerSpread)).toBe(false);
        const remapped = run(committed, { type: 'resize', geometry: single });
        expect(remapped.scene).toMatchObject({ phase: 'closing', view: { layout: 'single', page: 1 } });
        expect(closedFace(runFrames(remapped, single, 400))).toBe('front');
      });
    });
  });

  it('should expose helpers for views', () => {
    expect(initialView('spread')).toEqual({ layout: 'spread', spread: 0 });
    expect(initialView('single')).toEqual({ layout: 'single', page: SINGLE_LAYOUT_FIRST_PAGE });
    expect(firstVisiblePage({ layout: 'spread', spread: 2 })).toBe(5);
    expect(firstVisiblePage({ layout: 'single', page: 6 })).toBe(6);
  });
});
