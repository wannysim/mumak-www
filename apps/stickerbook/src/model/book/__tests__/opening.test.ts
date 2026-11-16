import { describe, expect, it } from 'vitest';

import {
  createOpeningTimeline,
  isOpeningDone,
  OPEN_COVER_ANGLE_DEG,
  OPEN_COVER_DURATION_MS,
  OPEN_HANDOFF_DURATION_MS,
  openingDuration,
  openingPoseAt,
  REDUCED_MOTION_CROSSFADE_MS,
  RETURN_TO_FRONT_DURATION_MS,
} from '../opening';
import { INITIAL_ROTATION } from '../rotation';

describe('opening timeline', () => {
  it('should turn back to the front for a time proportional to the angle', () => {
    const timeline = createOpeningTimeline(INITIAL_ROTATION);
    expect(timeline.to).toEqual({ yaw: 0, pitch: 0 });
    expect(timeline.returnMs).toBeCloseTo((RETURN_TO_FRONT_DURATION_MS * Math.sqrt(11 * 11 + 8 * 8)) / 90);
    expect(openingDuration(timeline)).toBeCloseTo(timeline.returnMs + OPEN_COVER_DURATION_MS);
  });

  it('should cap the return time when looking at the back cover', () => {
    const timeline = createOpeningTimeline({ yaw: 200, pitch: 10 });
    expect(timeline.to).toEqual({ yaw: 360, pitch: 0 });
    expect(timeline.returnMs).toBe(RETURN_TO_FRONT_DURATION_MS);
  });

  it('should rotate first, then open the cover while travelling to the page box', () => {
    const timeline = createOpeningTimeline({ yaw: 180, pitch: 0 });
    const start = openingPoseAt(timeline, 0);
    expect(start).toEqual({
      rotation: { yaw: 180, pitch: 0 },
      coverAngle: -0,
      travel: 0,
      handoff: 0,
      crossfade: false,
    });
    const turning = openingPoseAt(timeline, timeline.returnMs / 2);
    expect(turning.rotation.yaw).toBeGreaterThan(180);
    expect(turning.travel).toBe(0);
    const opening = openingPoseAt(timeline, timeline.returnMs + timeline.coverMs / 4);
    expect(opening.rotation).toEqual({ yaw: 360, pitch: 0 });
    expect(opening.coverAngle).toBeLessThan(0);
    expect(opening.travel).toBeGreaterThan(0);
    expect(isOpeningDone(timeline, timeline.returnMs + timeline.coverMs / 4)).toBe(false);
    const end = openingPoseAt(timeline, openingDuration(timeline));
    expect(end.coverAngle).toBe(OPEN_COVER_ANGLE_DEG);
    expect(end.travel).toBe(1);
    expect(isOpeningDone(timeline, openingDuration(timeline))).toBe(true);
  });

  it('should ease the return stage in and out so it does not stall before the cover opens', () => {
    const timeline = createOpeningTimeline({ yaw: 180, pitch: 0 });
    const early = openingPoseAt(timeline, timeline.returnMs * 0.25).rotation.yaw - 180;
    const late = 360 - openingPoseAt(timeline, timeline.returnMs * 0.75).rotation.yaw;
    expect(early).toBeCloseTo(late);
    expect(early).toBeLessThan(180 * 0.25);
  });

  it('should hold the final pose while handing over to the open book', () => {
    expect(openingDuration(createOpeningTimeline(INITIAL_ROTATION))).toBeGreaterThan(OPEN_COVER_DURATION_MS);
    const timeline = createOpeningTimeline({ yaw: 0, pitch: 0 });
    const end = openingDuration(timeline);
    expect(end).toBe(OPEN_COVER_DURATION_MS);
    const before = openingPoseAt(timeline, end - OPEN_HANDOFF_DURATION_MS);
    expect(before.handoff).toBe(0);
    expect(before.travel).toBeLessThan(1);
    const during = openingPoseAt(timeline, end - OPEN_HANDOFF_DURATION_MS / 2);
    expect(during).toEqual({
      rotation: timeline.to,
      coverAngle: OPEN_COVER_ANGLE_DEG,
      travel: 1,
      handoff: 0.5,
      crossfade: false,
    });
    expect(openingPoseAt(timeline, end).handoff).toBe(1);
  });

  it('should only crossfade with reduced motion', () => {
    const timeline = createOpeningTimeline({ yaw: 200, pitch: 10 }, true);
    expect(timeline).toMatchObject({ returnMs: 0, coverMs: 0, crossfade: true });
    expect(openingDuration(timeline)).toBe(REDUCED_MOTION_CROSSFADE_MS);
    expect(openingPoseAt(timeline, REDUCED_MOTION_CROSSFADE_MS / 4)).toEqual({
      rotation: { yaw: 200, pitch: 10 },
      coverAngle: 0,
      travel: 0,
      handoff: 0.25,
      crossfade: true,
    });
    expect(isOpeningDone(timeline, REDUCED_MOTION_CROSSFADE_MS)).toBe(true);
  });

  it('should skip the return stage when already facing front', () => {
    const timeline = createOpeningTimeline({ yaw: 0, pitch: 0 });
    expect(timeline.returnMs).toBe(0);
    expect(openingPoseAt(timeline, 0).travel).toBe(0);
    expect(openingPoseAt(timeline, OPEN_COVER_DURATION_MS).travel).toBe(1);
  });
});
