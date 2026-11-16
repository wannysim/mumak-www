import { describe, expect, it } from 'vitest';

import type { PageSize } from '../book-frame';
import { polygonArea, reflectAcrossFold, reflectPolygonAcrossFold, splitPageByFold } from '../reflect-fold';
import { computeTurnPose, projectToOuterEdge } from '../turn-pose';

const page: PageSize = { width: 400, height: 600 };

describe('turn-pose', () => {
  it('should have no fold and zero progress before the pointer moves', () => {
    const grab = { x: 400, y: 600 };

    expect(computeTurnPose(grab, grab, page)).toEqual({ grab, pointer: grab, fold: null, progress: 0 });
  });

  it('should fold the grabbed point onto the pointer while dragging', () => {
    const grab = { x: 400, y: 600 };
    const pose = computeTurnPose(grab, { x: 180, y: 520 }, page);
    const landed = reflectAcrossFold(grab, pose.fold!);

    expect(pose.pointer).toEqual({ x: 180, y: 520 });
    expect(landed.x).toBeCloseTo(180, 9);
    expect(landed.y).toBeCloseTo(520, 9);
    expect(pose.progress).toBeCloseTo(220 / 800, 12);
  });

  it('should apply the spine limit before folding', () => {
    const grab = { x: 400, y: 300 };
    const pose = computeTurnPose(grab, { x: -900, y: 300 }, page);

    expect(pose.pointer).toEqual({ x: -400, y: 300 });
    expect(pose.progress).toBe(1);
    expect(pose.fold!.midpoint).toEqual({ x: 0, y: 300 });
  });

  describe('grab point from a press', () => {
    it('should project a press onto the outer edge', () => {
      expect(projectToOuterEdge({ x: 120, y: 250 }, page)).toEqual({ x: 400, y: 250 });
    });

    it('should clamp presses above or below the page to the corners', () => {
      expect(projectToOuterEdge({ x: 380, y: -30 }, page)).toEqual({ x: 400, y: 0 });
      expect(projectToOuterEdge({ x: 380, y: 640 }, page)).toEqual({ x: 400, y: 600 });
    });

    it('should project a press outside the outer edge back onto it', () => {
      expect(projectToOuterEdge({ x: 410, y: 300 }, page)).toEqual({ x: 400, y: 300 });
    });
  });

  describe('right after a drag starts 8px toward the spine', () => {
    // 드래그 시작 프레임: 누른 점에서 8px(DEFAULT_DRAG_START_DISTANCE_PX) 움직였다.
    it.each([
      ['in the middle of the page', 200, 104 * 600],
      ['three quarters of the way out', 300, 54 * 600],
      ['on the outer edge', 400, 4 * 600],
    ])('should fold only half the gap between the edge and the pointer when pressed %s', (_, pressX, expectedArea) => {
      const press = { x: pressX, y: 300 };
      const pointer = { x: pressX - 8, y: 300 };
      const grab = projectToOuterEdge(press, page);
      const pose = computeTurnPose(grab, pointer, page);
      const split = splitPageByFold(page, pose.fold!);

      expect(polygonArea(split.folded)).toBeCloseTo(expectedArea, 6);
      expect(pose.progress).toBeCloseTo((400 - pointer.x) / 800, 12);
    });

    it('should keep the flap on the near side of the spine while the pointer is', () => {
      const grab = projectToOuterEdge({ x: 200, y: 300 }, page);
      const pose = computeTurnPose(grab, { x: 192, y: 300 }, page);
      const flap = reflectPolygonAcrossFold(splitPageByFold(page, pose.fold!).folded, pose.fold!);

      expect(Math.min(...flap.map(point => point.x))).toBeCloseTo(192, 9);
    });
  });
});
