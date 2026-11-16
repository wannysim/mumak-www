import { describe, expect, it } from 'vitest';

import type { BookFrame, Vec2 } from '@/model/fold';
import { computeTurnPose, reflectAcrossFold, toModelPoint } from '@/model/fold';
import { createFoldLine, polygonArea, signedDistanceToFold } from '@/model/fold/reflect-fold';

import type { LeafPlacement } from '../leaf-geometry';
import { affineFromPointMap, applyAffine, computeLeafLayers, toCssMatrix, toCssPolygon } from '../leaf-geometry';

const page = { width: 300, height: 400 };
const spreadFrame: BookFrame = { spineAxis: 'vertical', spineOrigin: { x: 300, y: 0 } };
const forward: LeafPlacement = { frame: spreadFrame, direction: 'forward', page };
const backward: LeafPlacement = { frame: spreadFrame, direction: 'backward', page };

function expectPointClose(actual: Vec2, expected: Vec2) {
  expect(actual.x).toBeCloseTo(expected.x, 6);
  expect(actual.y).toBeCloseTo(expected.y, 6);
}

describe('leaf geometry', () => {
  describe('affine helpers', () => {
    it('should recover an affine map from three points', () => {
      const matrix = affineFromPointMap(point => ({ x: 2 * point.x - point.y + 5, y: point.x + 3 * point.y - 1 }));
      expect(matrix).toEqual({ a: 2, b: 1, c: -1, d: 3, e: 5, f: -1 });
      expect(applyAffine(matrix, { x: 1, y: 2 })).toEqual({ x: 5, y: 6 });
    });

    it('should format CSS matrices without negative zero', () => {
      expect(toCssMatrix({ a: 1, b: -0, c: 0.12345678, d: 1, e: -0.0001, f: 12.34567 })).toBe(
        'matrix(1, 0, 0.123457, 1, 0, 12.346)'
      );
    });

    it('should format CSS polygons and hide degenerate ones', () => {
      expect(
        toCssPolygon([
          { x: 0, y: 0 },
          { x: 10.12345, y: 0 },
          { x: 0, y: 5 },
        ])
      ).toBe('polygon(0px 0px, 10.123px 0px, 0px 5px)');
      expect(
        toCssPolygon([
          { x: 0, y: 0 },
          { x: 0, y: 5 },
        ])
      ).toBe('polygon(0px 0px, 0px 0px, 0px 0px)');
    });
  });

  it('should leave the whole upper page and no flap when there is no fold', () => {
    const layers = computeLeafLayers(forward, null);
    expect(layers.upperOrigin).toEqual({ x: 300, y: 0 });
    expect(layers.flapRestOrigin).toEqual({ x: 0, y: 0 });
    expect(layers.upperClip).toEqual([
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 400 },
      { x: 0, y: 400 },
    ]);
    expect(layers.flapClip).toEqual([]);
    expect(layers.flapTransform).toEqual({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
  });

  it('should fold a vertical strip at the outer edge onto the upper page', () => {
    // 잡은 점 (300, 200)을 (240, 200)으로: 접힘선은 모델 x = 270.
    const fold = createFoldLine({ x: 300, y: 200 }, { x: 240, y: 200 });
    const layers = computeLeafLayers(forward, fold);
    expect(polygonArea(layers.upperClip)).toBeCloseTo(270 * 400);
    expect(polygonArea(layers.flapClip)).toBeCloseTo(30 * 400);
    // 뒷면 쪽(왼쪽 상자)의 바깥 가장자리 띠 x∈[0, 30]이 날개다.
    for (const point of layers.flapClip) {
      expect(point.x).toBeGreaterThanOrEqual(-1e-9);
      expect(point.x).toBeLessThanOrEqual(30 + 1e-9);
    }
    // 뒷면 바깥 가장자리(0, y)는 포인터 자리(책 좌표 300 + 240)에, 접힘선 쪽(30, y)은 접힘선(300 + 270)에 온다.
    expectPointClose(applyAffine(layers.flapTransform, { x: 0, y: 123 }), { x: 540, y: 123 });
    expectPointClose(applyAffine(layers.flapTransform, { x: 30, y: 10 }), { x: 570, y: 10 });
    // 글자가 뒤집히지 않는다(행렬식 +1).
    const { a, b, c, d } = layers.flapTransform;
    expect(a * d - b * c).toBeCloseTo(1, 9);
  });

  it('should land the flap exactly on the opposite page box when the leaf is fully turned', () => {
    const pose = computeTurnPose({ x: 300, y: 320 }, { x: -300, y: 320 }, page);
    const layers = computeLeafLayers(forward, pose.fold);
    expect(layers.upperClip.length).toBeLessThan(3);
    expect(polygonArea(layers.flapClip)).toBeCloseTo(300 * 400);
    const { a, b, c, d, e, f } = layers.flapTransform;
    expect([a, b, c, d]).toEqual([
      expect.closeTo(1, 9),
      expect.closeTo(0, 9),
      expect.closeTo(0, 9),
      expect.closeTo(1, 9),
    ]);
    expect(e).toBeCloseTo(0, 9);
    expect(f).toBeCloseTo(0, 9);
  });

  it('should mirror the layout going backward', () => {
    const layers = computeLeafLayers(backward, null);
    expect(layers.upperOrigin).toEqual({ x: 0, y: 0 });
    expect(layers.flapRestOrigin).toEqual({ x: 300, y: 0 });
    const fold = createFoldLine({ x: 300, y: 100 }, { x: 200, y: 160 });
    const folded = computeLeafLayers(backward, fold);
    // 모델 바깥 가장자리(왼쪽 쪽의 왼쪽 끝 = 책 좌표 x 0)가 접혀 들어간다.
    expect(polygonArea(folded.upperClip) + polygonArea(folded.flapClip)).toBeCloseTo(300 * 400);
    const { a, b, c, d } = folded.flapTransform;
    expect(a * d - b * c).toBeCloseTo(1, 9);
  });

  it.each([
    ['forward', forward],
    ['backward', backward],
  ] as const)('should map every flap vertex onto the reflected folded region (%s)', (_name, placement) => {
    const fold = createFoldLine({ x: 300, y: 380 }, { x: 120, y: 250 });
    if (fold === null) {
      throw new Error('fold expected');
    }
    const layers = computeLeafLayers(placement, fold);
    for (const vertex of layers.flapClip) {
      const bookPoint = applyAffine(layers.flapTransform, vertex);
      const model = toModelPoint(bookPoint, placement.frame, placement.direction);
      // 접힌 영역의 반사상은 접힘선의 평평한 쪽에 놓인다.
      expect(signedDistanceToFold(model, fold)).toBeGreaterThanOrEqual(-1e-9);
      // 다시 반사하면 원래 쪽 안(x∈[0, 쪽 폭])이다.
      const original = reflectAcrossFold(model, fold);
      expect(original.x).toBeGreaterThanOrEqual(-1e-9);
      expect(original.x).toBeLessThanOrEqual(300 + 1e-9);
    }
  });
});
