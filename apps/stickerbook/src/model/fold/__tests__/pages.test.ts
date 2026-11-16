import { describe, expect, it } from 'vitest';

import type { BookView } from '../pages';
import {
  assertPageCount,
  backwardTurnFromSpread,
  forwardTurnFromSpread,
  leafOfPage,
  leafPages,
  nextView,
  previousView,
  spreadCount,
  spreadOfPage,
  spreadPages,
  viewOfPage,
  visiblePages,
} from '../pages';

const PAGE_COUNT = 8;

describe('pages', () => {
  describe('page count', () => {
    it('should accept an even count of at least 2', () => {
      expect(() => assertPageCount(2)).not.toThrow();
      expect(spreadCount(PAGE_COUNT)).toBe(4);
    });

    it.each([0, 1, 7, 2.5, Number.NaN])('should reject %f pages', pageCount => {
      expect(() => assertPageCount(pageCount)).toThrow(RangeError);
    });
  });

  describe('spreads and leaves', () => {
    it('should show pages 1 and 2 on spread 0', () => {
      expect(spreadPages(0)).toEqual({ left: 1, right: 2 });
      expect(spreadPages(2)).toEqual({ left: 5, right: 6 });
    });

    it('should find the spread that holds a page', () => {
      expect([1, 2, 3, 4, 5].map(spreadOfPage)).toEqual([0, 0, 1, 1, 2]);
    });

    it('should put page 3 on the back of the leaf whose front is page 2', () => {
      expect(leafPages(0)).toEqual({ front: 2, back: 3 });
      expect(leafOfPage(2, PAGE_COUNT)).toEqual({ leaf: 0, side: 'front' });
      expect(leafOfPage(3, PAGE_COUNT)).toEqual({ leaf: 0, side: 'back' });
      expect(leafOfPage(6, PAGE_COUNT)).toEqual({ leaf: 2, side: 'front' });
    });

    it('should keep the first and last pages off the turnable leaves', () => {
      expect(leafOfPage(1, PAGE_COUNT)).toBeNull();
      expect(leafOfPage(PAGE_COUNT, PAGE_COUNT)).toBeNull();
    });
  });

  describe('turning forward from spread 0 (plan.md example)', () => {
    it('should lift page 2, show page 3 on its back and reveal page 4 underneath', () => {
      expect(forwardTurnFromSpread(0, PAGE_COUNT)).toEqual({
        leaf: 0,
        direction: 'forward',
        frontPage: 2,
        backPage: 3,
        revealedPage: 4,
      });
    });

    it('should not turn past the last spread', () => {
      expect(forwardTurnFromSpread(3, PAGE_COUNT)).toBeNull();
    });
  });

  describe('turning backward', () => {
    it('should lift page 3 back and reveal page 1 from spread 1', () => {
      expect(backwardTurnFromSpread(1, PAGE_COUNT)).toEqual({
        leaf: 0,
        direction: 'backward',
        frontPage: 2,
        backPage: 3,
        revealedPage: 1,
      });
    });

    it('should not turn before the first spread', () => {
      expect(backwardTurnFromSpread(0, PAGE_COUNT)).toBeNull();
    });
  });

  describe("'spread' layout", () => {
    const first: BookView = { layout: 'spread', spread: 0 };

    it('should show both pages of the spread', () => {
      expect(visiblePages(first)).toEqual([1, 2]);
    });

    it('should move to the next spread by turning one leaf', () => {
      expect(nextView(first, PAGE_COUNT)).toEqual({
        view: { layout: 'spread', spread: 1 },
        turn: forwardTurnFromSpread(0, PAGE_COUNT),
      });
    });

    it('should move back by turning the same leaf backward', () => {
      expect(previousView({ layout: 'spread', spread: 1 }, PAGE_COUNT)).toEqual({
        view: first,
        turn: backwardTurnFromSpread(1, PAGE_COUNT),
      });
    });

    it('should stop at both ends', () => {
      expect(previousView(first, PAGE_COUNT)).toBeNull();
      expect(nextView({ layout: 'spread', spread: 3 }, PAGE_COUNT)).toBeNull();
    });
  });

  describe("'single' layout (one page at a time)", () => {
    it('should show one page', () => {
      expect(visiblePages({ layout: 'single', page: 3 })).toEqual([3]);
    });

    it('should move within the spread without turning from a left page', () => {
      expect(nextView({ layout: 'single', page: 1 }, PAGE_COUNT)).toEqual({
        view: { layout: 'single', page: 2 },
        turn: null,
      });
    });

    it('should turn the leaf when moving on from a right page', () => {
      expect(nextView({ layout: 'single', page: 2 }, PAGE_COUNT)).toEqual({
        view: { layout: 'single', page: 3 },
        turn: forwardTurnFromSpread(0, PAGE_COUNT),
      });
    });

    it('should turn the leaf back when moving back from a left page', () => {
      expect(previousView({ layout: 'single', page: 3 }, PAGE_COUNT)).toEqual({
        view: { layout: 'single', page: 2 },
        turn: backwardTurnFromSpread(1, PAGE_COUNT),
      });
    });

    it('should move within the spread without turning back from a right page', () => {
      expect(previousView({ layout: 'single', page: 4 }, PAGE_COUNT)).toEqual({
        view: { layout: 'single', page: 3 },
        turn: null,
      });
    });

    it('should stop at the first and last pages', () => {
      expect(previousView({ layout: 'single', page: 1 }, PAGE_COUNT)).toBeNull();
      expect(nextView({ layout: 'single', page: PAGE_COUNT }, PAGE_COUNT)).toBeNull();
    });

    it('should visit every page once from first to last, turning each leaf once', () => {
      const visited: number[] = [];
      const turnedLeaves: number[] = [];
      let view: BookView | undefined = { layout: 'single', page: 1 };
      while (view !== undefined) {
        visited.push(...visiblePages(view));
        const move = nextView(view, PAGE_COUNT);
        if (move?.turn) {
          turnedLeaves.push(move.turn.leaf);
        }
        view = move?.view;
      }

      expect(visited).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(turnedLeaves).toEqual([0, 1, 2]);
    });
  });

  it('should find the view that shows a page in either layout', () => {
    expect(viewOfPage(5, 'spread')).toEqual({ layout: 'spread', spread: 2 });
    expect(viewOfPage(5, 'single')).toEqual({ layout: 'single', page: 5 });
  });

  it('should reject an invalid page count when navigating', () => {
    expect(() => nextView({ layout: 'single', page: 1 }, 5)).toThrow(RangeError);
    expect(() => previousView({ layout: 'spread', spread: 1 }, 5)).toThrow(RangeError);
    expect(() => leafOfPage(2, 3)).toThrow(RangeError);
    expect(() => backwardTurnFromSpread(1, 3)).toThrow(RangeError);
  });

  describe('views outside the book', () => {
    it.each([0, -1, PAGE_COUNT + 1, 2.5, Number.NaN])("should reject 'single' page %f", page => {
      const view: BookView = { layout: 'single', page };

      expect(() => nextView(view, PAGE_COUNT)).toThrow(RangeError);
      expect(() => previousView(view, PAGE_COUNT)).toThrow(RangeError);
      expect(() => leafOfPage(page, PAGE_COUNT)).toThrow(RangeError);
    });

    it.each([-1, 4, 1.5, Number.NaN])("should reject 'spread' %f", spread => {
      const view: BookView = { layout: 'spread', spread };

      expect(() => nextView(view, PAGE_COUNT)).toThrow(RangeError);
      expect(() => previousView(view, PAGE_COUNT)).toThrow(RangeError);
      expect(() => forwardTurnFromSpread(spread, PAGE_COUNT)).toThrow(RangeError);
      expect(() => backwardTurnFromSpread(spread, PAGE_COUNT)).toThrow(RangeError);
    });

    it('should accept the first and last views', () => {
      expect(nextView({ layout: 'single', page: PAGE_COUNT }, PAGE_COUNT)).toBeNull();
      expect(previousView({ layout: 'spread', spread: 0 }, PAGE_COUNT)).toBeNull();
    });
  });
});
