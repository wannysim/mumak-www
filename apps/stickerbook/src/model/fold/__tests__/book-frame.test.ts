import { describe, expect, it } from 'vitest';

import type { BookFrame, TurnDirection } from '../book-frame';
import { toModelPageSize, toModelPoint, toModelVector, toScreenPoint, toScreenVector } from '../book-frame';

const verticalFrame: BookFrame = { spineAxis: 'vertical', spineOrigin: { x: 500, y: 100 } };
const horizontalFrame: BookFrame = { spineAxis: 'horizontal', spineOrigin: { x: 40, y: 700 } };

describe('book-frame', () => {
  describe('vertical spine (left-right spread)', () => {
    it('should put the right page at positive model x when turning forward', () => {
      expect(toModelPoint({ x: 900, y: 400 }, verticalFrame, 'forward')).toEqual({ x: 400, y: 300 });
    });

    it('should mirror the left page into positive model x when turning backward', () => {
      expect(toModelPoint({ x: 100, y: 400 }, verticalFrame, 'backward')).toEqual({ x: 400, y: 300 });
    });

    it('should flip the x component of vectors when turning backward', () => {
      expect(toModelVector({ x: 0.4, y: -0.1 }, verticalFrame, 'forward')).toEqual({ x: 0.4, y: -0.1 });
      expect(toModelVector({ x: 0.4, y: -0.1 }, verticalFrame, 'backward')).toEqual({ x: -0.4, y: -0.1 });
    });
  });

  describe('horizontal spine (top-bottom arrangement)', () => {
    it('should put the lower page at positive model x when turning forward', () => {
      expect(toModelPoint({ x: 340, y: 1100 }, horizontalFrame, 'forward')).toEqual({ x: 400, y: 300 });
    });

    it('should mirror the upper page into positive model x when turning backward', () => {
      expect(toModelPoint({ x: 340, y: 300 }, horizontalFrame, 'backward')).toEqual({ x: 400, y: 300 });
    });

    it('should swap axes for vectors', () => {
      expect(toModelVector({ x: 0.2, y: -0.5 }, horizontalFrame, 'forward')).toEqual({ x: -0.5, y: 0.2 });
      expect(toModelVector({ x: 0.2, y: -0.5 }, horizontalFrame, 'backward')).toEqual({ x: 0.5, y: 0.2 });
    });
  });

  const roundTripCases: Array<[BookFrame, TurnDirection]> = [
    [verticalFrame, 'forward'],
    [verticalFrame, 'backward'],
    [horizontalFrame, 'forward'],
    [horizontalFrame, 'backward'],
  ];

  it.each(roundTripCases)('should round-trip points and vectors for %o turning %s', (frame, direction) => {
    const screenPoint = { x: 123.5, y: 456.25 };
    const screenVector = { x: -0.75, y: 0.125 };

    expect(toScreenPoint(toModelPoint(screenPoint, frame, direction), frame, direction)).toEqual(screenPoint);
    expect(toScreenVector(toModelVector(screenVector, frame, direction), frame, direction)).toEqual(screenVector);
  });

  it('should map the screen page size to model width along the turning axis', () => {
    const screenPage = { screenWidth: 300, screenHeight: 450 };

    expect(toModelPageSize(screenPage, 'vertical')).toEqual({ width: 300, height: 450 });
    expect(toModelPageSize(screenPage, 'horizontal')).toEqual({ width: 450, height: 300 });
  });
});
