import { describe, expect, it } from 'vitest';

import { pageFold } from '@/book/page-fold';

const grip = { y: 0.9, pullY: 0 };
describe('fold geometry without rasterizing page contents', () => {
  it('keeps flat front and reverse faces at their original scale with upright letters', () => {
    for (const direction of [-1, 1] as const) {
      const start = pageFold(480, 620, 0, direction, grip);
      const end = pageFold(480, 620, 1, direction, grip);
      expect(start).toHaveLength(1);
      expect(start[0]!.face).toBe('front');
      expect(end).toHaveLength(1);
      expect(end[0]!.face).toBe('back');
      for (const piece of [...start, ...end]) {
        const [a, b, c, d] = piece.matrix;
        expect(a).toBeCloseTo(1);
        expect(b).toBeCloseTo(0);
        expect(c).toBeCloseTo(0);
        expect(d).toBeCloseTo(1);
      }
      expect(start[0]!.matrix[4]).toBeCloseTo(direction === 1 ? 0 : -480);
      expect(end[0]!.matrix[4]).toBeCloseTo(direction === 1 ? -480 : 0);
    }
  });
  it('uses rigid flat faces and confines compression to the curved band', () => {
    for (const direction of [-1, 1] as const) {
      for (const progress of [0.001, 0.1, 0.5, 0.9, 0.999]) {
        const pieces = pageFold(175, 226, progress, direction, grip);
        expect(pieces.length).toBeLessThanOrEqual(14);
        for (const piece of pieces) {
          const [a, b, c, d] = piece.matrix;
          expect(piece.matrix.every(Number.isFinite)).toBe(true);
          // No mirrored letters or perspective scale on either flat face.
          expect(a * d - b * c).toBeGreaterThan(0);
          if (piece.shade === 0) {
            expect(Math.hypot(a, b)).toBeCloseTo(1);
            expect(Math.hypot(c, d)).toBeCloseTo(1);
          }
        }
      }
    }
  });
  it('changes the crease with the held corner and vertical pull', () => {
    const lower = pageFold(480, 620, 0.2, 1, grip);
    const upper = pageFold(480, 620, 0.2, 1, { y: 0.1, pullY: 0 });
    expect(lower[0]!.clip).not.toBe(upper[0]!.clip);
    expect(lower.at(-1)!.matrix[1]).toBeGreaterThan(0);
    expect(upper.at(-1)!.matrix[1]).toBeLessThan(0);
    expect(pageFold(480, 620, 0.2, 1, { ...grip, pullY: 0.5 })).not.toEqual(lower);
    expect(pageFold(480, 620, -1, 1, grip)).toEqual(pageFold(480, 620, 0, 1, grip));
    expect(pageFold(480, 620, 2, 1, grip)).toEqual(pageFold(480, 620, 1, 1, grip));
  });
});
