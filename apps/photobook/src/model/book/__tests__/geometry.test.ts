import { describe, expect, it } from 'vitest';

import {
  BOOK_DEPTH_RATIO,
  computeClosedPlacement,
  computeOpenGeometry,
  coverLayout,
  isSamePageSize,
  pageBoxes,
  PAGE_ASPECT,
  RUNNING_HEAD_CLEARANCE_REM,
  SCREEN_EDGE_DRAG_GUARD_PX,
  toBookLocal,
  TURN_EDGE_BAND_RATIO,
  turnFrame,
} from '../geometry';

describe('geometry', () => {
  describe('spread', () => {
    const viewport = { width: 1440, height: 900 };
    const geometry = computeOpenGeometry(viewport, 'spread');

    it('should follow the spread-a formulas on a desktop screen', () => {
      expect(geometry.page.height).toBe(676);
      expect(geometry.page.width).toBe(676 * PAGE_ASPECT);
      expect(geometry.book).toEqual({ x: 213, y: 112, width: 1014, height: 676 });
    });

    it('should run the click columns from the screen edges into the outer page bands', () => {
      const band = geometry.page.width * TURN_EDGE_BAND_RATIO;
      expect(geometry.turnZones.backward).toEqual({ x: 0, y: 112, width: 213 + band, height: 676 });
      expect(geometry.turnZones.forward.x).toBeCloseTo(213 + 1014 - band);
      expect(geometry.turnZones.forward.x + geometry.turnZones.forward.width).toBeCloseTo(1440);
      expect(geometry.turnZones.backward.width).toBeGreaterThanOrEqual(24);
    });

    it('should start drags only inside the screen edge guard', () => {
      const { backward, forward } = geometry.dragZones;
      expect(backward.x).toBe(SCREEN_EDGE_DRAG_GUARD_PX);
      expect(backward.x + backward.width).toBeCloseTo(geometry.turnZones.backward.width);
      expect(forward.x).toBeCloseTo(geometry.turnZones.forward.x);
      expect(forward.x + forward.width).toBeCloseTo(1440 - SCREEN_EDGE_DRAG_GUARD_PX);
    });

    it('should keep the book below the running head on short landscape screens', () => {
      for (const size of [
        { width: 844, height: 390 },
        { width: 667, height: 375 },
      ]) {
        const landscape = computeOpenGeometry(size, 'spread');
        expect(landscape.book.y).toBeGreaterThanOrEqual(RUNNING_HEAD_CLEARANCE_REM * 16);
        expect(landscape.book.y + landscape.book.height).toBeLessThanOrEqual(size.height);
        expect(landscape.book.x).toBeGreaterThan(0);
      }
    });

    it('should shrink the side reserve on narrow and portrait screens', () => {
      const tablet = computeOpenGeometry({ width: 768, height: 1024 }, 'spread');
      expect(tablet.book.x).toBeCloseTo(768 * 0.06);
      expect(tablet.page.height).toBeCloseTo((768 - 2 * 768 * 0.06) / (2 * PAGE_ASPECT));
      const narrow = computeOpenGeometry({ width: 601, height: 900 }, 'spread');
      expect(narrow.book.x).toBeCloseTo(2.5 * 16);
    });

    it('should use the measured root font size', () => {
      const larger = computeOpenGeometry({ width: 844, height: 390, rootFontPx: 20 }, 'spread');
      expect(larger.book.y).toBe(RUNNING_HEAD_CLEARANCE_REM * 20);
      const unreadable = computeOpenGeometry({ width: 1440, height: 900, rootFontPx: Number.NaN }, 'spread');
      expect(unreadable.book).toEqual(geometry.book);
    });

    it('should keep a positive page on a tiny screen', () => {
      const tiny = computeOpenGeometry({ width: 0, height: 0 }, 'spread');
      expect(tiny.page.height).toBeGreaterThan(0);
      expect(tiny.page.width).toBeGreaterThan(0);
      expect(tiny.dragZones.forward.width).toBe(0);
    });

    it('should place the closed book centered and scaled from the right page box', () => {
      const placement = computeClosedPlacement(viewport, geometry);
      expect(placement.target).toEqual({ x: 720, y: 112, width: geometry.page.width, height: 676 });
      expect(placement.center).toEqual({ x: 720, y: 450 });
      expect(placement.scale).toBeCloseTo(522 / 676);
      expect(placement.frontBox.height).toBeCloseTo(522);
      expect(placement.frontBox.width).toBeCloseTo(522 * PAGE_ASPECT);
      expect(placement.frontBox.x + placement.frontBox.width / 2).toBeCloseTo(720);
      expect(placement.depth).toBeCloseTo(geometry.page.width * BOOK_DEPTH_RATIO);
    });

    it('should lay the front cover over the right page and the back cover over the left page', () => {
      const pageBox = (x: number) => ({ x, y: 112, width: geometry.page.width, height: 676 });
      expect(coverLayout(geometry, 'front', { layout: 'spread', spread: 0 })).toEqual({
        inside: 1,
        under: 2,
        body: pageBox(213 + geometry.page.width),
      });
      expect(coverLayout(geometry, 'front', { layout: 'spread', spread: 2 })).toMatchObject({ inside: 5, under: 6 });
      expect(coverLayout(geometry, 'back', { layout: 'spread', spread: 3 })).toEqual({
        inside: 8,
        under: 7,
        body: pageBox(213),
      });
      const placement = computeClosedPlacement(viewport, geometry, pageBox(213));
      expect(placement.target).toEqual(pageBox(213));
      expect(placement.center).toEqual({ x: 720, y: 450 });
    });

    it('should expose two page boxes and a spine at the middle', () => {
      expect(pageBoxes(geometry)).toEqual([
        { x: 0, y: 0, width: geometry.page.width, height: 676 },
        { x: geometry.page.width, y: 0, width: geometry.page.width, height: 676 },
      ]);
      expect(turnFrame(geometry, 'forward').spineOrigin).toEqual({ x: geometry.page.width, y: 0 });
      expect(turnFrame(geometry, 'backward').spineOrigin).toEqual({ x: geometry.page.width, y: 0 });
    });

    it('should convert viewport points to book-local points', () => {
      expect(toBookLocal({ x: 300, y: 200 }, geometry)).toEqual({ x: 87, y: 88 });
    });

    it('should compare page sizes', () => {
      expect(isSamePageSize(geometry.page, { ...geometry.page })).toBe(true);
      expect(isSamePageSize(geometry.page, { ...geometry.page, height: 1 })).toBe(false);
      expect(isSamePageSize(geometry.page, { ...geometry.page, width: 1 })).toBe(false);
    });
  });

  describe('single', () => {
    const viewport = { width: 390, height: 844, rootFontPx: 15 };
    const geometry = computeOpenGeometry(viewport, 'single');

    it('should fill the phone width minus the side gutters below the running head', () => {
      expect(geometry.layout).toBe('single');
      expect(geometry.page.width).toBeCloseTo(390 - 2 * 1.25 * 15);
      expect(geometry.page.height).toBeCloseTo(geometry.page.width / PAGE_ASPECT);
      expect(geometry.book.x).toBeCloseTo(1.25 * 15);
      expect(geometry.book.y).toBeGreaterThanOrEqual(RUNNING_HEAD_CLEARANCE_REM * 15);
    });

    it('should let a drag start anywhere on the page, split at the middle, but not at the screen edges', () => {
      const { backward, forward } = geometry.dragZones;
      const middle = geometry.book.x + geometry.book.width / 2;
      expect(backward.x).toBe(SCREEN_EDGE_DRAG_GUARD_PX);
      expect(backward.x + backward.width).toBeCloseTo(middle);
      expect(forward.x).toBeCloseTo(middle);
      expect(forward.x + forward.width).toBeCloseTo(390 - SCREEN_EDGE_DRAG_GUARD_PX);
      expect(geometry.turnZones.backward.x).toBe(0);
      const wide = computeOpenGeometry({ width: 600, height: 800 }, 'single');
      expect(wide.book.x).toBeGreaterThan(SCREEN_EDGE_DRAG_GUARD_PX);
      expect(wide.dragZones.backward.x).toBeCloseTo(wide.book.x);
      expect(wide.dragZones.forward.x + wide.dragZones.forward.width).toBeCloseTo(wide.book.x + wide.book.width);
    });

    it('should place the closed book over the single page', () => {
      const placement = computeClosedPlacement(viewport, geometry);
      expect(placement.target).toBe(geometry.book);
      expect(placement.scale).toBeLessThan(1);
    });

    it('should keep the book body off screen beyond the spine when the visible page is the board inside', () => {
      const { book, page } = geometry;
      const at = (x: number) => ({ x, y: book.y, width: page.width, height: page.height });
      // 2쪽: 앞표지와 1쪽이 왼쪽 화면 밖에서 넘어와 2쪽을 덮는다(펼침의 거꾸로).
      expect(coverLayout(geometry, 'front', { layout: 'single', page: 2 })).toEqual({
        inside: 1,
        under: 2,
        body: at(book.x),
      });
      // 1쪽: 앞표지 판이 화면의 쪽 상자를 채우고, 책 몸(2쪽)은 오른쪽 화면 밖이다.
      expect(coverLayout(geometry, 'front', { layout: 'single', page: 1 })).toEqual({
        inside: 1,
        under: 2,
        body: at(book.x + page.width),
      });
      // 8쪽: 뒤표지 판이 화면을 채우고, 책 몸(7쪽)은 왼쪽 화면 밖이다.
      expect(coverLayout(geometry, 'back', { layout: 'single', page: 8 })).toEqual({
        inside: 8,
        under: 7,
        body: at(book.x - page.width),
      });
      expect(coverLayout(geometry, 'back', { layout: 'single', page: 7 })).toEqual({
        inside: 8,
        under: 7,
        body: at(book.x),
      });
    });

    it('should fold the visible page around its left edge going forward and its right edge going back', () => {
      expect(pageBoxes(geometry)).toHaveLength(1);
      expect(turnFrame(geometry, 'forward').spineOrigin).toEqual({ x: 0, y: 0 });
      expect(turnFrame(geometry, 'backward').spineOrigin).toEqual({ x: geometry.page.width, y: 0 });
    });

    it('should keep a positive page when the height is too small', () => {
      expect(computeOpenGeometry({ width: 300, height: 10 }, 'single').page.width).toBeGreaterThan(0);
    });
  });
});
