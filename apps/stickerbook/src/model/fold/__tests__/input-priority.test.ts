import { describe, expect, it } from 'vitest';

import type { GestureContext, GestureEvent, GestureState, InputSurface } from '../input-priority';
import {
  DEFAULT_DRAG_START_DISTANCE_PX,
  hasReachedDragStart,
  IDLE_GESTURE,
  isPointInRect,
  reduceGesture,
  resolveInputOwner,
} from '../input-priority';

const link = { id: 'colophon-contact', kind: 'link', rect: { x: 520, y: 400, width: 120, height: 24 } } as const;
const sticker = { id: 'fox-1', kind: 'sticker', rect: { x: 600, y: 380, width: 80, height: 80 } } as const;
const record = { id: 'record', kind: 'record', rect: { x: 760, y: 100, width: 40, height: 300 } } as const;

const surface: InputSurface = {
  interactiveRegions: [sticker, link, record],
  turnRegions: [
    { direction: 'backward', rect: { x: 0, y: 0, width: 400, height: 600 } },
    { direction: 'forward', rect: { x: 400, y: 0, width: 400, height: 600 } },
  ],
};

const context: GestureContext = { surface, dragStartDistancePx: DEFAULT_DRAG_START_DISTANCE_PX };

function run(events: GestureEvent[], initial: GestureState = IDLE_GESTURE) {
  let state = initial;
  const effects = [];
  for (const event of events) {
    const step = reduceGesture(state, event, context);
    state = step.state;
    effects.push(step.effect);
  }
  return { state, effects };
}

describe('input-priority', () => {
  describe('resolveInputOwner', () => {
    it('should give a link priority over the turn region beneath it', () => {
      expect(resolveInputOwner({ x: 530, y: 410 }, surface)).toEqual({ type: 'interactive', region: link });
    });

    it('should give a record priority over the turn region beneath it', () => {
      expect(resolveInputOwner({ x: 780, y: 200 }, surface)).toEqual({ type: 'interactive', region: record });
    });

    it('should pick the front-most interactive region when regions overlap', () => {
      expect(resolveInputOwner({ x: 620, y: 410 }, surface)).toEqual({ type: 'interactive', region: sticker });
    });

    it('should fall back to the turn region outside interactive regions', () => {
      expect(resolveInputOwner({ x: 700, y: 550 }, surface)).toEqual({ type: 'turn', direction: 'forward' });
      expect(resolveInputOwner({ x: 50, y: 550 }, surface)).toEqual({ type: 'turn', direction: 'backward' });
    });

    it('should return null outside every region', () => {
      expect(resolveInputOwner({ x: 900, y: 900 }, surface)).toBeNull();
    });
  });

  it('should include rectangle edges', () => {
    const rect = { x: 10, y: 20, width: 30, height: 40 };

    expect(isPointInRect({ x: 10, y: 20 }, rect)).toBe(true);
    expect(isPointInRect({ x: 40, y: 60 }, rect)).toBe(true);
    expect(isPointInRect({ x: 40.01, y: 60 }, rect)).toBe(false);
    expect(isPointInRect({ x: 10, y: 19.99 }, rect)).toBe(false);
  });

  it('should start a drag exactly at the threshold distance', () => {
    expect(hasReachedDragStart({ x: 0, y: 0 }, { x: 7.99, y: 0 }, 8)).toBe(false);
    expect(hasReachedDragStart({ x: 0, y: 0 }, { x: 8, y: 0 }, 8)).toBe(true);
    expect(hasReachedDragStart({ x: 0, y: 0 }, { x: 4.8, y: 6.4 }, 8)).toBe(true);
  });

  describe('reduceGesture', () => {
    it('should report a click on a link without turning the page', () => {
      const { state, effects } = run([
        { type: 'down', pointerId: 1, point: { x: 530, y: 410 } },
        { type: 'move', pointerId: 1, point: { x: 535, y: 412 } },
        { type: 'up', pointerId: 1, point: { x: 535, y: 412 } },
      ]);

      expect(state).toEqual(IDLE_GESTURE);
      expect(effects.at(-1)).toEqual({
        type: 'click',
        owner: { type: 'interactive', region: link },
        point: { x: 535, y: 412 },
      });
    });

    it('should hand a drag that starts on a sticker to the sticker, not the turn', () => {
      const { effects } = run([
        { type: 'down', pointerId: 1, point: { x: 650, y: 450 } },
        { type: 'move', pointerId: 1, point: { x: 640, y: 450 } },
      ]);

      expect(effects[1]).toEqual({
        type: 'drag-start',
        owner: { type: 'interactive', region: sticker },
        origin: { x: 650, y: 450 },
        point: { x: 640, y: 450 },
      });
    });

    it('should stay pressed until the pointer moves the threshold distance', () => {
      const { state, effects } = run([
        { type: 'down', pointerId: 1, point: { x: 700, y: 550 } },
        { type: 'move', pointerId: 1, point: { x: 692.01, y: 550 } },
      ]);

      expect(state.phase).toBe('pressed');
      expect(effects).toEqual([{ type: 'none' }, { type: 'none' }]);
    });

    it('should run a turn drag from start to end', () => {
      const { state, effects } = run([
        { type: 'down', pointerId: 1, point: { x: 790, y: 590 } },
        { type: 'move', pointerId: 1, point: { x: 782, y: 590 } },
        { type: 'move', pointerId: 1, point: { x: 600, y: 560 } },
        { type: 'up', pointerId: 1, point: { x: 380, y: 540 } },
      ]);
      const turnOwner = { type: 'turn', direction: 'forward' };

      expect(state).toEqual(IDLE_GESTURE);
      expect(effects).toEqual([
        { type: 'none' },
        { type: 'drag-start', owner: turnOwner, origin: { x: 790, y: 590 }, point: { x: 782, y: 590 } },
        { type: 'drag-move', owner: turnOwner, point: { x: 600, y: 560 } },
        { type: 'drag-end', owner: turnOwner, point: { x: 380, y: 540 } },
      ]);
    });

    it('should treat an up without moves as a click on the turn region', () => {
      const { effects } = run([
        { type: 'down', pointerId: 1, point: { x: 700, y: 300 } },
        { type: 'up', pointerId: 1, point: { x: 700, y: 300 } },
      ]);

      expect(effects[1]).toEqual({
        type: 'click',
        owner: { type: 'turn', direction: 'forward' },
        point: { x: 700, y: 300 },
      });
    });

    it('should not click when released past the drag distance without a move', () => {
      const { state, effects } = run([
        { type: 'down', pointerId: 1, point: { x: 700, y: 300 } },
        { type: 'up', pointerId: 1, point: { x: 300, y: 300 } },
      ]);

      expect(state).toEqual(IDLE_GESTURE);
      expect(effects).toEqual([{ type: 'none' }, { type: 'none' }]);
    });

    it('should not click a link when released far away after small moves', () => {
      const { state, effects } = run([
        { type: 'down', pointerId: 1, point: { x: 530, y: 410 } },
        { type: 'move', pointerId: 1, point: { x: 535, y: 412 } },
        { type: 'up', pointerId: 1, point: { x: 530, y: 418 } },
      ]);

      expect(state).toEqual(IDLE_GESTURE);
      expect(effects.at(-1)).toEqual({ type: 'none' });
    });

    it('should still click when released just inside the drag distance', () => {
      const { effects } = run([
        { type: 'down', pointerId: 1, point: { x: 700, y: 300 } },
        { type: 'up', pointerId: 1, point: { x: 692.01, y: 300 } },
      ]);

      expect(effects.at(-1)).toEqual({
        type: 'click',
        owner: { type: 'turn', direction: 'forward' },
        point: { x: 692.01, y: 300 },
      });
    });

    it('should ignore presses outside every region', () => {
      const { state, effects } = run([
        { type: 'down', pointerId: 1, point: { x: 900, y: 900 } },
        { type: 'up', pointerId: 1, point: { x: 900, y: 900 } },
      ]);

      expect(state).toEqual(IDLE_GESTURE);
      expect(effects).toEqual([{ type: 'none' }, { type: 'none' }]);
    });

    it('should ignore moves, ups and cancels while idle', () => {
      const { effects } = run([
        { type: 'move', pointerId: 1, point: { x: 700, y: 300 } },
        { type: 'up', pointerId: 1, point: { x: 700, y: 300 } },
        { type: 'cancel', pointerId: 1 },
      ]);

      expect(effects).toEqual([{ type: 'none' }, { type: 'none' }, { type: 'none' }]);
    });

    it('should follow only the first pointer', () => {
      const { state, effects } = run([
        { type: 'down', pointerId: 1, point: { x: 700, y: 300 } },
        { type: 'down', pointerId: 2, point: { x: 530, y: 410 } },
        { type: 'move', pointerId: 2, point: { x: 100, y: 410 } },
        { type: 'up', pointerId: 2, point: { x: 100, y: 410 } },
      ]);

      expect(state).toMatchObject({ phase: 'pressed', pointerId: 1 });
      expect(effects).toEqual([{ type: 'none' }, { type: 'none' }, { type: 'none' }, { type: 'none' }]);
    });

    it('should drop a press silently on cancel', () => {
      const { state, effects } = run([
        { type: 'down', pointerId: 1, point: { x: 700, y: 300 } },
        { type: 'cancel', pointerId: 1 },
      ]);

      expect(state).toEqual(IDLE_GESTURE);
      expect(effects[1]).toEqual({ type: 'none' });
    });

    it('should report a cancelled drag', () => {
      const { state, effects } = run([
        { type: 'down', pointerId: 1, point: { x: 700, y: 300 } },
        { type: 'move', pointerId: 1, point: { x: 650, y: 300 } },
        { type: 'cancel', pointerId: 1 },
      ]);

      expect(state).toEqual(IDLE_GESTURE);
      expect(effects[2]).toEqual({ type: 'drag-cancel', owner: { type: 'turn', direction: 'forward' } });
    });
  });
});
