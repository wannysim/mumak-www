import { describe, expect, it } from 'vitest';

import type { RotateGesture } from '../rotation';
import {
  angularDistance,
  clampPitch,
  DEGREES_PER_DRAG_PX,
  frontRotation,
  IDLE_ROTATE_GESTURE,
  INITIAL_ROTATION,
  interpolateRotation,
  isFaceTurnedAway,
  normalizeDegrees,
  PITCH_LIMIT_DEG,
  reduceRotateGesture,
  rotateByDrag,
  rotateByKeyStep,
  visibleFace,
} from '../rotation';

describe('rotation', () => {
  it('should start from the closed-a pose with the front cover facing the viewer', () => {
    expect(INITIAL_ROTATION).toEqual({ yaw: -11, pitch: -8 });
    expect(visibleFace(INITIAL_ROTATION)).toBe('front');
  });

  describe('drag', () => {
    it('should turn yaw freely and tilt pitch against the vertical drag', () => {
      const rotated = rotateByDrag({ yaw: 0, pitch: 0 }, { x: 100, y: 100 }, { x: 200, y: 90 });
      expect(rotated.yaw).toBeCloseTo(100 * DEGREES_PER_DRAG_PX);
      expect(rotated.pitch).toBeCloseTo(10 * DEGREES_PER_DRAG_PX);
    });

    it('should keep pitch inside the limit', () => {
      expect(rotateByDrag({ yaw: 0, pitch: 0 }, { x: 0, y: 0 }, { x: 0, y: -1000 }).pitch).toBe(PITCH_LIMIT_DEG);
      expect(clampPitch(-1000)).toBe(-PITCH_LIMIT_DEG);
      expect(clampPitch(3)).toBe(3);
    });

    it('should let yaw accumulate past a full turn', () => {
      expect(rotateByDrag({ yaw: 350, pitch: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 }).yaw).toBeCloseTo(390);
    });
  });

  describe('key steps', () => {
    it('should snap to the nearest face then turn 90 degrees', () => {
      expect(rotateByKeyStep(INITIAL_ROTATION, 1)).toEqual({ yaw: 90, pitch: -8 });
      expect(rotateByKeyStep(INITIAL_ROTATION, -1)).toEqual({ yaw: -90, pitch: -8 });
      expect(rotateByKeyStep({ yaw: 170, pitch: 0 }, 1)).toEqual({ yaw: 270, pitch: 0 });
    });
  });

  describe('faces', () => {
    it.each([
      [0, 'front'],
      [44.9, 'front'],
      [45, 'spine'],
      [90, 'spine'],
      [135, 'back'],
      [180, 'back'],
      [225, 'fore'],
      [314.9, 'fore'],
      [315, 'front'],
      [-90, 'fore'],
      [-180, 'back'],
      [720, 'front'],
    ])('should show the right face at yaw %f', (yaw, face) => {
      expect(visibleFace({ yaw, pitch: 0 })).toBe(face);
    });

    it('should call a large face turned away only when it clearly faces backwards', () => {
      expect(isFaceTurnedAway(0)).toBe(false);
      expect(isFaceTurnedAway(-11)).toBe(false);
      expect(isFaceTurnedAway(90)).toBe(false);
      expect(isFaceTurnedAway(100)).toBe(false);
      expect(isFaceTurnedAway(120)).toBe(true);
      expect(isFaceTurnedAway(180)).toBe(true);
      expect(isFaceTurnedAway(-180 + 360 * 3)).toBe(true);
    });

    it('should normalize degrees into [0, 360)', () => {
      expect(normalizeDegrees(-360)).toBe(0);
      expect(Object.is(normalizeDegrees(-0), 0)).toBe(true);
      expect(normalizeDegrees(370)).toBe(10);
      expect(normalizeDegrees(-10)).toBe(350);
      expect(normalizeDegrees(-1e-15)).toBe(0);
    });
  });

  describe('front pose', () => {
    it('should find the nearest front-facing yaw and level the pitch', () => {
      expect(frontRotation({ yaw: -11, pitch: -8 })).toEqual({ yaw: 0, pitch: 0 });
      expect(frontRotation({ yaw: 200, pitch: 10 })).toEqual({ yaw: 360, pitch: 0 });
      expect(frontRotation({ yaw: -170, pitch: 0 })).toEqual({ yaw: 0, pitch: 0 });
    });

    it('should measure and interpolate angles', () => {
      expect(angularDistance({ yaw: 0, pitch: 0 }, { yaw: 3, pitch: 4 })).toBe(5);
      expect(interpolateRotation({ yaw: 0, pitch: 0 }, { yaw: 10, pitch: -10 }, 0.5)).toEqual({ yaw: 5, pitch: -5 });
    });
  });

  describe('gesture', () => {
    const current = { yaw: 0, pitch: 0 };

    function press(): RotateGesture {
      return reduceRotateGesture(IDLE_ROTATE_GESTURE, { type: 'down', pointerId: 1, point: { x: 10, y: 10 } }, current)
        .gesture;
    }

    it('should ignore events other than down while idle', () => {
      const step = reduceRotateGesture(
        IDLE_ROTATE_GESTURE,
        { type: 'up', pointerId: 1, point: { x: 0, y: 0 } },
        current
      );
      expect(step).toEqual({ gesture: IDLE_ROTATE_GESTURE, rotation: null, suppressClick: null });
    });

    it('should treat a short press as a click', () => {
      const pressed = reduceRotateGesture(
        IDLE_ROTATE_GESTURE,
        { type: 'down', pointerId: 1, point: { x: 10, y: 10 } },
        current
      );
      expect(pressed.suppressClick).toBe(false);
      const moved = reduceRotateGesture(
        pressed.gesture,
        { type: 'move', pointerId: 1, point: { x: 13, y: 10 } },
        current
      );
      expect(moved.rotation).toBeNull();
      const released = reduceRotateGesture(
        moved.gesture,
        { type: 'up', pointerId: 1, point: { x: 13, y: 10 } },
        current
      );
      expect(released).toEqual({ gesture: IDLE_ROTATE_GESTURE, rotation: null, suppressClick: false });
    });

    it('should rotate once the drag start distance is reached and suppress the click', () => {
      const started = reduceRotateGesture(press(), { type: 'move', pointerId: 1, point: { x: 18, y: 10 } }, current);
      expect(started.gesture.phase).toBe('dragging');
      expect(started.rotation?.yaw).toBeCloseTo(8 * DEGREES_PER_DRAG_PX);
      const dragged = reduceRotateGesture(
        started.gesture,
        { type: 'move', pointerId: 1, point: { x: 20, y: 10 } },
        current
      );
      expect(dragged.rotation?.yaw).toBeCloseTo(10 * DEGREES_PER_DRAG_PX);
      const released = reduceRotateGesture(
        dragged.gesture,
        { type: 'up', pointerId: 1, point: { x: 30, y: 10 } },
        current
      );
      expect(released.suppressClick).toBe(true);
      expect(released.rotation?.yaw).toBeCloseTo(20 * DEGREES_PER_DRAG_PX);
    });

    it('should not open when released far away without moves', () => {
      const released = reduceRotateGesture(press(), { type: 'up', pointerId: 1, point: { x: 100, y: 10 } }, current);
      expect(released.suppressClick).toBe(true);
      expect(released.rotation).toBeNull();
    });

    it('should ignore other pointers and extra downs', () => {
      const pressed = press();
      expect(
        reduceRotateGesture(pressed, { type: 'move', pointerId: 2, point: { x: 99, y: 99 } }, current).gesture
      ).toBe(pressed);
      expect(
        reduceRotateGesture(pressed, { type: 'down', pointerId: 1, point: { x: 99, y: 99 } }, current).gesture
      ).toBe(pressed);
    });

    it('should cancel without rotating', () => {
      const cancelled = reduceRotateGesture(press(), { type: 'cancel', pointerId: 1 }, current);
      expect(cancelled).toEqual({ gesture: IDLE_ROTATE_GESTURE, rotation: null, suppressClick: true });
    });
  });
});
