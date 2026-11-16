import { describe, expect, it } from 'vitest';

import type { PageSize } from '../book-frame';
import { createFoldLine, signedDistanceToFold } from '../reflect-fold';
import { isWithinSpineLimit, limitPointerToSpine, spineEndpoints } from '../spine-limit';
import { computeTurnPose } from '../turn-pose';
import type { Vec2 } from '../vector';
import { distanceVec } from '../vector';

const page: PageSize = { width: 400, height: 600 };

function expectPointClose(actual: Vec2, expected: Vec2, digits = 6) {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
}

/** 두 책등 끝점의 접힘선 부호 거리 중 작은 값. 접힘이 없으면 Infinity. 0 이상이면 책등이 평평한 쪽에 남는다. */
function lowestSpineSignedDistance(grab: Vec2, pointer: Vec2): number {
  const fold = createFoldLine(grab, pointer);
  if (fold === null) {
    return Number.POSITIVE_INFINITY;
  }
  const { top, bottom } = spineEndpoints(page);
  return Math.min(signedDistanceToFold(top, fold), signedDistanceToFold(bottom, fold));
}

type SpineFoldCase = { readonly grab: Vec2; readonly rawPointer: Vec2; readonly lowest: number };

/** 책등 끝점이 접히는 쪽(부호 거리 < 0)에 들어간 경우만 모은다. */
function collectSpineFolds(cases: Iterable<{ readonly grab: Vec2; readonly rawPointer: Vec2 }>): SpineFoldCase[] {
  const folds: SpineFoldCase[] = [];
  for (const { grab, rawPointer } of cases) {
    const lowest = lowestSpineSignedDistance(grab, limitPointerToSpine(rawPointer, grab, page));
    if (lowest < 0) {
      folds.push({ grab, rawPointer, lowest });
    }
  }
  return folds;
}

describe('spine-limit', () => {
  it('should place the spine endpoints at the top and bottom of x = 0', () => {
    expect(spineEndpoints(page)).toEqual({ top: { x: 0, y: 0 }, bottom: { x: 0, y: 600 } });
  });

  it('should keep a pointer that is already inside both circles', () => {
    const pointer = { x: 100, y: 300 };

    expect(limitPointerToSpine(pointer, { x: 400, y: 300 }, page)).toBe(pointer);
  });

  describe('when trying to pull past the spine', () => {
    it('should stop at the mirror of the grab point when pulling straight across', () => {
      const grab = { x: 400, y: 300 };
      const limited = limitPointerToSpine({ x: -700, y: 300 }, grab, page);

      expect(limited).toEqual({ x: -400, y: 300 });
      // 접힘선이 책등 자체라 끝점 부호 거리가 정확히 0(-0 포함)이다.
      expect(lowestSpineSignedDistance(grab, limited)).toBeGreaterThanOrEqual(0);
    });

    it('should snap back to the grab point when pulling far outward', () => {
      const grab = { x: 400, y: 300 };

      expect(limitPointerToSpine({ x: 1500, y: 300 }, grab, page)).toBe(grab);
    });

    it('should project onto the top circle when only that circle is exceeded', () => {
      const grab = { x: 400, y: 600 };
      const limited = limitPointerToSpine({ x: -300, y: 700 }, grab, page);

      expect(distanceVec(limited, { x: 0, y: 0 })).toBeCloseTo(distanceVec(grab, { x: 0, y: 0 }), 9);
      expect(limited.x / limited.y).toBeCloseTo(-300 / 700, 12);
      expect(lowestSpineSignedDistance(grab, limited)).toBeGreaterThanOrEqual(0);
    });

    it('should project onto the bottom circle when only that circle is exceeded', () => {
      const grab = { x: 400, y: 600 };
      const limited = limitPointerToSpine({ x: -420, y: 300 }, grab, page);

      expect(distanceVec(limited, { x: 0, y: 600 })).toBeCloseTo(400, 9);
      expectPointClose(limited, {
        x: -420 * (400 / Math.sqrt(420 * 420 + 300 * 300)),
        y: 600 - 300 * (400 / Math.sqrt(420 * 420 + 300 * 300)),
      });
      expect(lowestSpineSignedDistance(grab, limited)).toBeGreaterThanOrEqual(0);
    });
  });

  it('should pin the pointer to the grab point when the grab is on the spine', () => {
    const grab = { x: 0, y: 300 };

    expect(limitPointerToSpine({ x: 150, y: 320 }, grab, page)).toBe(grab);
    expect(limitPointerToSpine({ x: 0, y: 341 }, grab, page)).toBe(grab);
  });

  describe('when pulling outward along a ray from a spine endpoint through the grab point', () => {
    // 투영이 G에서 반올림 오차만큼 떨어진 점에 떨어지면 접힘선 방향이 임의가 되어 책등이 접혔다(리뷰 재현값).
    it.each([
      ['top edge, pulled along the edge', { x: 200, y: 0 }, { x: 265, y: 0 }],
      ['inside the page, 1.25 times the top radius', { x: 100, y: 200 }, { x: 125, y: 250 }],
      ['bottom corner, pulled along the bottom edge', { x: 400, y: 600 }, { x: 401, y: 600 }],
    ])('should snap back to the grab point with no fold (%s)', (_, grab, rawPointer) => {
      const pose = computeTurnPose(grab, rawPointer, page);

      expect(pose.pointer).toBe(grab);
      expect(pose.fold).toBeNull();
      expect(pose.progress).toBe(0);
    });

    it('should never fold a spine endpoint for any grab and pull factor', () => {
      const { top, bottom } = spineEndpoints(page);
      function* rayCases() {
        for (let grabX = 0; grabX <= 400; grabX += 10) {
          for (let grabY = 0; grabY <= 600; grabY += 20) {
            const grab = { x: grabX, y: grabY };
            for (const endpoint of [top, bottom]) {
              for (let factor = 1.01; factor < 3; factor += 0.07) {
                const rawPointer = {
                  x: endpoint.x + (grab.x - endpoint.x) * factor,
                  y: endpoint.y + (grab.y - endpoint.y) * factor,
                };
                yield { grab, rawPointer };
              }
            }
          }
        }
      }

      expect(collectSpineFolds(rayCases())).toEqual([]);
    });
  });

  it('should keep the spine flat for pointers a few micro-pixels from the grab point in any direction', () => {
    // 원 위에 투영된 점의 반올림 오차가 |P - G|로 나뉘어 커지는 구간이다.
    function* ringCases() {
      for (const grab of [
        { x: 400, y: 300 },
        { x: 400, y: 100 },
        { x: 400, y: 600 },
        { x: 250, y: 450 },
        { x: 200, y: 0 },
      ]) {
        for (const offset of [2e-6, 1e-5, 1e-4, 1e-3, 1e-2]) {
          for (let step = 0; step < 64; step += 1) {
            const angle = (step / 64) * 2 * Math.PI;
            yield { grab, rawPointer: { x: grab.x + offset * Math.cos(angle), y: grab.y + offset * Math.sin(angle) } };
          }
        }
      }
    }

    expect(collectSpineFolds(ringCases())).toEqual([]);
  });

  it('should snap a pointer within a rounding error of a lens vertex to the vertex itself', () => {
    const grab = { x: 400, y: 300 };

    expect(limitPointerToSpine({ x: 400 - 1e-9, y: 300 }, grab, page)).toBe(grab);
    expect(limitPointerToSpine({ x: -400 + 1e-9, y: 300 }, grab, page)).toEqual({ x: -400, y: 300 });
    expect(limitPointerToSpine({ x: 400 - 1e-3, y: 300 }, grab, page)).toEqual({ x: 400 - 1e-3, y: 300 });
  });

  it('should keep both spine endpoints on the flat side for any pointer', () => {
    const grabs = [
      { x: 400, y: 0 },
      { x: 400, y: 600 },
      { x: 400, y: 300 },
      { x: 400, y: 120 },
      { x: 250, y: 450 },
      { x: 200, y: 0 },
      { x: 100, y: 200 },
    ];
    const outsideLimit: Vec2[] = [];
    function* gridCases() {
      for (const grab of grabs) {
        for (let x = -1200; x <= 1200; x += 25) {
          for (let y = -900; y <= 1500; y += 25) {
            const rawPointer = { x, y };
            if (!isWithinSpineLimit(limitPointerToSpine(rawPointer, grab, page), grab, page)) {
              outsideLimit.push(rawPointer);
            }
            yield { grab, rawPointer };
          }
        }
      }
    }

    expect(collectSpineFolds(gridCases())).toEqual([]);
    expect(outsideLimit).toEqual([]);
  });

  it('should report whether a pointer is inside the limit', () => {
    const grab = { x: 400, y: 300 };

    expect(isWithinSpineLimit({ x: 0, y: 300 }, grab, page)).toBe(true);
    expect(isWithinSpineLimit({ x: -401, y: 300 }, grab, page)).toBe(false);
    expect(isWithinSpineLimit({ x: 0, y: -201 }, grab, page)).toBe(false);
  });
});
