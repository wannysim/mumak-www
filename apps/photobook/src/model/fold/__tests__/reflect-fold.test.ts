import { describe, expect, it } from 'vitest';

import type { PageSize } from '../book-frame';
import {
  createFoldLine,
  isFoldedPoint,
  pageCorners,
  polygonArea,
  reflectAcrossFold,
  reflectPolygonAcrossFold,
  signedDistanceToFold,
  splitPageByFold,
} from '../reflect-fold';

const page: PageSize = { width: 400, height: 600 };

describe('reflect-fold', () => {
  it('should return null when the pointer has not moved from the grab point', () => {
    expect(createFoldLine({ x: 400, y: 300 }, { x: 400, y: 300 })).toBeNull();
  });

  describe('when grabbing the middle of the outer edge', () => {
    const grab = { x: 400, y: 300 };
    const pointer = { x: 200, y: 300 };
    const fold = createFoldLine(grab, pointer)!;

    it('should place the fold line on the perpendicular bisector', () => {
      expect(fold.midpoint).toEqual({ x: 300, y: 300 });
      expect(fold.normal).toEqual({ x: -1, y: 0 });
    });

    it('should land the grabbed point exactly under the pointer', () => {
      expect(reflectAcrossFold(grab, fold)).toEqual(pointer);
    });

    it('should not count points on the fold line as folded', () => {
      expect(isFoldedPoint({ x: 300, y: 0 }, fold)).toBe(false);
      expect(isFoldedPoint({ x: 300, y: 600 }, fold)).toBe(false);
      expect(isFoldedPoint({ x: 300.001, y: 600 }, fold)).toBe(true);
    });

    it('should fold the strip beyond the fold line and keep the rest flat', () => {
      const split = splitPageByFold(page, fold);

      expect(split.flat).toEqual([
        { x: 0, y: 0 },
        { x: 300, y: 0 },
        { x: 300, y: 600 },
        { x: 0, y: 600 },
      ]);
      expect(split.folded).toEqual([
        { x: 300, y: 0 },
        { x: 400, y: 0 },
        { x: 400, y: 600 },
        { x: 300, y: 600 },
      ]);
      expect(reflectPolygonAcrossFold(split.folded, fold)).toEqual([
        { x: 300, y: 0 },
        { x: 200, y: 0 },
        { x: 200, y: 600 },
        { x: 300, y: 600 },
      ]);
    });
  });

  describe('when grabbing the bottom outer corner', () => {
    const grab = { x: 400, y: 600 };
    const pointer = { x: 250, y: 520 };
    const fold = createFoldLine(grab, pointer)!;

    it('should land the grabbed corner under the pointer', () => {
      const landed = reflectAcrossFold(grab, fold);

      expect(landed.x).toBeCloseTo(pointer.x, 9);
      expect(landed.y).toBeCloseTo(pointer.y, 9);
    });

    it('should mark the grabbed corner as folded and the spine as flat', () => {
      expect(isFoldedPoint(grab, fold)).toBe(true);
      expect(isFoldedPoint({ x: 0, y: 0 }, fold)).toBe(false);
      expect(isFoldedPoint({ x: 0, y: 600 }, fold)).toBe(false);
    });

    it('should split the page into a folded triangle and a flat pentagon that cover the page', () => {
      const split = splitPageByFold(page, fold);

      expect(split.folded).toHaveLength(3);
      expect(split.flat).toHaveLength(5);
      expect(polygonArea(split.flat) + polygonArea(split.folded)).toBeCloseTo(page.width * page.height, 6);
    });

    it('should keep every reflected folded point at the same distance from the fold line', () => {
      const split = splitPageByFold(page, fold);
      for (const point of split.folded) {
        const reflected = reflectAcrossFold(point, fold);
        expect(signedDistanceToFold(reflected, fold)).toBeCloseTo(-signedDistanceToFold(point, fold), 9);
      }
    });
  });

  it('should include vertices lying on the fold line in both halves without duplicates', () => {
    // 정사각형 쪽에서 위 바깥 모서리를 아래 책등 모서리로 접으면 접힘선이 대각선이 되어 두 꼭짓점을 지난다.
    const square: PageSize = { width: 400, height: 400 };
    const fold = createFoldLine({ x: 400, y: 0 }, { x: 0, y: 400 })!;
    const split = splitPageByFold(square, fold);

    expect(split.flat).toEqual([
      { x: 0, y: 0 },
      { x: 400, y: 400 },
      { x: 0, y: 400 },
    ]);
    expect(split.folded).toEqual([
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 400 },
    ]);
  });

  it('should leave nothing folded when the fold line lies outside the page', () => {
    const fold = createFoldLine({ x: 900, y: 300 }, { x: 600, y: 300 })!;
    const split = splitPageByFold(page, fold);

    expect(split.folded).toEqual([]);
    expect(split.flat).toEqual(pageCorners(page));
  });

  it('should measure polygon area regardless of winding', () => {
    const clockwise = pageCorners(page);

    expect(polygonArea(clockwise)).toBe(240000);
    expect(polygonArea(clockwise.toReversed())).toBe(240000);
  });
});
