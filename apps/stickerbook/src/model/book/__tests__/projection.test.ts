import { describe, expect, it } from 'vitest';

import { computeClosedPlacement, computeOpenGeometry } from '../geometry';
import {
  bookCorners,
  bookMotionFrame,
  CLOSED_PERSPECTIVE_PX,
  closedPerspective,
  convexHull,
  isPointInConvexPolygon,
  outlineBounds,
  perspectiveOriginInBook,
  projectBookPoint,
  projectedBookOutline,
} from '../projection';
import { IDENTITY_QUAT, quatFromAxisAngle, X_AXIS, Y_AXIS } from '../quaternion';
import { INITIAL_ORIENTATION } from '../rotation';

const viewport = { width: 1440, height: 900 };
const geometry = computeOpenGeometry(viewport, 'spread');
const placement = computeClosedPlacement(viewport, geometry);
const perspective = closedPerspective(viewport);

describe('projection', () => {
  it('should look from the stage camera above the middle', () => {
    expect(perspective).toEqual({ distance: CLOSED_PERSPECTIVE_PX, origin: { x: 720, y: 180 } });
  });

  it.each([
    [{ width: 1440, height: 900 }, 'spread'],
    [{ width: 844, height: 390 }, 'spread'],
    [{ width: 390, height: 844 }, 'single'],
    [{ width: 768, height: 1024 }, 'spread'],
  ] as const)('should find the stage camera in book coordinates at %o (%s)', (size, layout) => {
    const open = computeOpenGeometry(size, layout);
    expect(perspectiveOriginInBook(open) + open.book.x).toBeCloseTo(closedPerspective(size).origin.x, 9);
  });

  it('should move the book from the screen center at closed size to the target box at page size', () => {
    const closed = bookMotionFrame(placement, 0);
    expect(closed.scale).toBe(placement.scale);
    expect(closed.offset.x).toBeCloseTo(placement.center.x - (placement.target.x + placement.target.width / 2));
    expect(closed.offset.z === 0).toBe(true);
    const open = bookMotionFrame(placement, 1);
    expect(open.offset.x === 0 && open.offset.y === 0).toBe(true);
    expect(open.offset.z).toBe(-placement.depth / 2);
    expect(open.scale).toBe(1);
  });

  it('should list the eight corners of the book box', () => {
    const corners = bookCorners(placement);
    expect(corners).toHaveLength(8);
    expect(corners).toContainEqual({
      x: placement.target.width / 2,
      y: -placement.target.height / 2,
      z: placement.depth / 2,
    });
  });

  it('should land the front face on the target box at travel 1 without perspective change', () => {
    const { target, depth } = placement;
    const corner = projectBookPoint(
      { x: target.width / 2, y: target.height / 2, z: depth / 2 },
      placement,
      IDENTITY_QUAT,
      1,
      perspective
    );
    expect(corner.x).toBeCloseTo(target.x + target.width);
    expect(corner.y).toBeCloseTo(target.y + target.height);
  });

  it('should enlarge points nearer the camera', () => {
    const near = projectBookPoint({ x: 100, y: 0, z: 200 }, placement, IDENTITY_QUAT, 1, perspective);
    const far = projectBookPoint({ x: 100, y: 0, z: -200 }, placement, IDENTITY_QUAT, 1, perspective);
    expect(near.x - perspective.origin.x).toBeGreaterThan(far.x - perspective.origin.x);
  });

  describe('convex polygon', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];

    it('should keep only the hull corners', () => {
      const hull = convexHull([...square, { x: 5, y: 5 }, { x: 5, y: 0 }, { x: 2, y: 8 }]);
      expect(hull).toHaveLength(4);
      for (const corner of square) {
        expect(hull).toContainEqual(corner);
      }
      expect(convexHull([{ x: 1, y: 1 }])).toEqual([{ x: 1, y: 1 }]);
    });

    it('should tell inside, boundary and outside points in either winding', () => {
      for (const polygon of [square, square.toReversed()]) {
        expect(isPointInConvexPolygon({ x: 5, y: 5 }, polygon)).toBe(true);
        expect(isPointInConvexPolygon({ x: 10, y: 5 }, polygon)).toBe(true);
        expect(isPointInConvexPolygon({ x: 0, y: 0 }, polygon)).toBe(true);
        expect(isPointInConvexPolygon({ x: 11, y: 5 }, polygon)).toBe(false);
        expect(isPointInConvexPolygon({ x: -1, y: -1 }, polygon)).toBe(false);
      }
      expect(isPointInConvexPolygon({ x: 0, y: 0 }, square.slice(0, 2))).toBe(false);
    });
  });

  describe('book outline', () => {
    const { frontBox, center } = placement;

    it('should cover the front cover in the first pose and miss the empty corners of the screen', () => {
      const outline = projectedBookOutline(viewport, placement, INITIAL_ORIENTATION);
      expect(isPointInConvexPolygon(center, outline)).toBe(true);
      expect(isPointInConvexPolygon({ x: frontBox.x + 20, y: frontBox.y + 40 }, outline)).toBe(true);
      expect(isPointInConvexPolygon({ x: 100, y: 100 }, outline)).toBe(false);
      expect(isPointInConvexPolygon({ x: frontBox.x - 40, y: center.y }, outline)).toBe(false);
    });

    it('should shrink to the spine when the spine faces the screen', () => {
      const outline = projectedBookOutline(viewport, placement, quatFromAxisAngle(Y_AXIS, 90));
      const bounds = outlineBounds(outline);
      expect(bounds.width).toBeLessThan(frontBox.width / 4);
      expect(isPointInConvexPolygon(center, outline)).toBe(true);
      expect(isPointInConvexPolygon({ x: frontBox.x + 20, y: center.y }, outline)).toBe(false);
    });

    it('should follow the book when it is tilted to show the bottom', () => {
      const outline = projectedBookOutline(viewport, placement, quatFromAxisAngle(X_AXIS, 90));
      const bounds = outlineBounds(outline);
      expect(bounds.height).toBeLessThan(frontBox.height / 4);
      expect(bounds.width).toBeGreaterThan(frontBox.width * 0.9);
      expect(isPointInConvexPolygon({ x: center.x, y: frontBox.y + 20 }, outline)).toBe(false);
    });

    it('should grow the bounds to the 24px minimum around their middle', () => {
      const bounds = outlineBounds([
        { x: 100, y: 100 },
        { x: 110, y: 100 },
        { x: 110, y: 200 },
      ]);
      expect(bounds).toEqual({ x: 93, y: 100, width: 24, height: 100 });
    });
  });
});
