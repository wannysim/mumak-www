import { describe, expect, it } from 'vitest';

import { facingFace } from '@/test/book-faces';

import {
  createOpeningTimeline,
  isOpeningDone,
  OPEN_COVER_DURATION_MS,
  OPEN_HANDOFF_DURATION_MS,
  openingDuration,
  openingPoseAt,
  REDUCED_MOTION_CROSSFADE_MS,
  RETURN_TO_FRONT_DURATION_MS,
  stageProgress,
  turnDuration,
} from '../opening';
import type { Quat } from '../quaternion';
import { angleBetweenQuat, IDENTITY_QUAT, multiplyQuat, quatFromAxisAngle, X_AXIS, Y_AXIS } from '../quaternion';
import { INITIAL_ORIENTATION, restOrientation } from '../rotation';

function yaw(degrees: number): Quat {
  return quatFromAxisAngle(Y_AXIS, degrees);
}

describe('opening timeline', () => {
  it('should turn back to the front for a time proportional to the angle', () => {
    const timeline = createOpeningTimeline(INITIAL_ORIENTATION);
    expect(timeline.to).toBe(IDENTITY_QUAT);
    const angle = angleBetweenQuat(INITIAL_ORIENTATION, IDENTITY_QUAT);
    expect(angle).toBeGreaterThan(11);
    expect(angle).toBeLessThan(19);
    expect(timeline.returnMs).toBeCloseTo((RETURN_TO_FRONT_DURATION_MS * angle) / 90);
    expect(openingDuration(timeline)).toBeCloseTo(timeline.returnMs + OPEN_COVER_DURATION_MS);
  });

  it('should cap the return time when looking at the back or the bottom', () => {
    expect(createOpeningTimeline(restOrientation('back')).returnMs).toBe(RETURN_TO_FRONT_DURATION_MS);
    expect(turnDuration(IDENTITY_QUAT, quatFromAxisAngle(X_AXIS, 150))).toBe(RETURN_TO_FRONT_DURATION_MS);
  });

  it('should slerp to the front first, then open the cover while travelling to the page box', () => {
    const timeline = createOpeningTimeline(yaw(180));
    const start = openingPoseAt(timeline, 0);
    expect(start).toEqual({
      orientation: yaw(180),
      side: 'front',
      coverOpen: 0,
      travel: 0,
      handoff: 0,
      crossfade: false,
    });
    const turning = openingPoseAt(timeline, timeline.returnMs / 2);
    expect(angleBetweenQuat(turning.orientation, IDENTITY_QUAT)).toBeCloseTo(90, 0);
    expect(turning.travel).toBe(0);
    const opening = openingPoseAt(timeline, timeline.returnMs + timeline.coverMs / 4);
    expect(opening.orientation).toBe(IDENTITY_QUAT);
    expect(opening.coverOpen).toBeGreaterThan(0);
    expect(opening.travel).toBe(opening.coverOpen);
    expect(isOpeningDone(timeline, timeline.returnMs + timeline.coverMs / 4)).toBe(false);
    const end = openingPoseAt(timeline, openingDuration(timeline));
    expect(end.coverOpen).toBe(1);
    expect(end.travel).toBe(1);
    expect(isOpeningDone(timeline, openingDuration(timeline))).toBe(true);
  });

  it('should come back to the front by the shortest way from a pose turned upside down', () => {
    const upsideDown = multiplyQuat(quatFromAxisAngle(X_AXIS, 170), yaw(20));
    const timeline = createOpeningTimeline(upsideDown);
    const quarter = openingPoseAt(timeline, timeline.returnMs * 0.25).orientation;
    const angle = angleBetweenQuat(upsideDown, IDENTITY_QUAT);
    expect(angleBetweenQuat(quarter, IDENTITY_QUAT)).toBeLessThan(angle);
    expect(facingFace(openingPoseAt(timeline, timeline.returnMs).orientation)).toBe('front');
  });

  it('should ease the return stage in and out so it does not stall before the cover opens', () => {
    const timeline = createOpeningTimeline(yaw(180));
    const early = 180 - angleBetweenQuat(openingPoseAt(timeline, timeline.returnMs * 0.25).orientation, IDENTITY_QUAT);
    const late = angleBetweenQuat(openingPoseAt(timeline, timeline.returnMs * 0.75).orientation, IDENTITY_QUAT);
    expect(early).toBeCloseTo(late);
    expect(early).toBeLessThan(180 * 0.25);
  });

  it('should hold the final pose while handing over to the open book', () => {
    expect(openingDuration(createOpeningTimeline(INITIAL_ORIENTATION))).toBeGreaterThan(OPEN_COVER_DURATION_MS);
    const timeline = createOpeningTimeline(IDENTITY_QUAT);
    const end = openingDuration(timeline);
    expect(end).toBe(OPEN_COVER_DURATION_MS);
    const before = openingPoseAt(timeline, end - OPEN_HANDOFF_DURATION_MS);
    expect(before.handoff).toBe(0);
    expect(before.travel).toBeLessThan(1);
    const during = openingPoseAt(timeline, end - OPEN_HANDOFF_DURATION_MS / 2);
    expect(during).toEqual({
      orientation: timeline.to,
      side: 'front',
      coverOpen: 1,
      travel: 1,
      handoff: 0.5,
      crossfade: false,
    });
    expect(openingPoseAt(timeline, end).handoff).toBe(1);
  });

  it('should only crossfade with reduced motion', () => {
    const from = restOrientation('back');
    const timeline = createOpeningTimeline(from, true);
    expect(timeline).toMatchObject({ returnMs: 0, coverMs: 0, crossfade: true });
    expect(openingDuration(timeline)).toBe(REDUCED_MOTION_CROSSFADE_MS);
    expect(openingPoseAt(timeline, REDUCED_MOTION_CROSSFADE_MS / 4)).toEqual({
      orientation: from,
      side: 'front',
      coverOpen: 0,
      travel: 0,
      handoff: 0.25,
      crossfade: true,
    });
    expect(isOpeningDone(timeline, REDUCED_MOTION_CROSSFADE_MS)).toBe(true);
  });

  it('should skip the return stage when already facing front', () => {
    const timeline = createOpeningTimeline(IDENTITY_QUAT);
    expect(timeline.returnMs).toBe(0);
    expect(openingPoseAt(timeline, 0).travel).toBe(0);
    expect(openingPoseAt(timeline, OPEN_COVER_DURATION_MS).travel).toBe(1);
  });

  it('should treat an empty stage as finished', () => {
    expect(stageProgress(10, 0)).toBe(1);
    expect(stageProgress(-5, 100)).toBe(0);
    expect(stageProgress(50, 100)).toBe(0.5);
  });
});
