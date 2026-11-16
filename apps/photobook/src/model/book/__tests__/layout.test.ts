import { describe, expect, it } from 'vitest';

import {
  decideLayout,
  rootFontPx,
  RUNNING_HEAD_STATUS_MIN_WIDTH_REM,
  runningHeadParts,
  SINGLE_LAYOUT_MAX_WIDTH_PX,
} from '../layout';

describe('decideLayout', () => {
  it.each([
    [{ width: 390, height: 844 }, 'single'],
    [{ width: 360, height: 780 }, 'single'],
    [{ width: SINGLE_LAYOUT_MAX_WIDTH_PX, height: 900 }, 'single'],
    [{ width: 844, height: 390 }, 'spread'],
    [{ width: 768, height: 1024 }, 'spread'],
    [{ width: 1440, height: 900 }, 'spread'],
    [{ width: 500, height: 520 }, 'spread'],
  ] as const)('should choose %o → %s', (viewport, layout) => {
    expect(decideLayout(viewport)).toBe(layout);
  });
});

describe('runningHeadParts', () => {
  it('should keep only the name on a phone and drop the status line when it does not fit', () => {
    expect(runningHeadParts({ width: 390, height: 844 }, 'single')).toEqual({ line: false, status: false });
    expect(runningHeadParts({ width: 667, height: 375 }, 'spread')).toEqual({ line: true, status: false });
    expect(runningHeadParts({ width: RUNNING_HEAD_STATUS_MIN_WIDTH_REM * 16, height: 900 }, 'spread')).toEqual({
      line: true,
      status: true,
    });
    expect(runningHeadParts({ width: 800, height: 900, rootFontPx: 20 }, 'spread').status).toBe(false);
  });

  it('should read the measured root font size or fall back to the browser default', () => {
    expect(rootFontPx({ width: 1, height: 1, rootFontPx: 15 })).toBe(15);
    expect(rootFontPx({ width: 1, height: 1 })).toBe(16);
    expect(rootFontPx({ width: 1, height: 1, rootFontPx: 0 })).toBe(16);
    expect(rootFontPx({ width: 1, height: 1, rootFontPx: Number.POSITIVE_INFINITY })).toBe(16);
  });
});
