import { describe, expect, it } from 'vitest';

import { computeLayout, nextPage, peelResult, shouldCompleteTurn, visibleStart } from '@/lib/interaction';

const area = { left: 0, top: 70, width: 1200, height: 700 };
describe('book fits actual available space', () => {
  it.each([
    [390, 650, 'spread'],
    [320, 480, 'spread'],
    [1024, 600, 'spread'],
    [850, 300, 'spread'],
    [900, 240, 'spread'],
  ])('fits %s × %s in %s mode', (width, height, mode) => {
    const layout = computeLayout({ ...area, width: Number(width), height: Number(height) });
    expect(layout.mode).toBe(mode);
    expect(layout.x).toBeGreaterThanOrEqual(0);
    expect(layout.x + layout.width).toBeLessThanOrEqual(Number(width));
    expect(layout.y + layout.height).toBeLessThanOrEqual(Number(height));
  });
  it('aligns spread to asymmetric segments and keeps the hinge clear', () => {
    const layout = computeLayout(area, [
      { left: 0, top: 0, width: 560, height: 900 },
      { left: 610, top: 0, width: 590, height: 900 },
    ]);
    expect(layout.posture).toBe('book');
    const pageWidth = (layout.width - layout.gap) / 2;
    expect(layout.x + pageWidth).toBeLessThan(560);
    expect(layout.x + pageWidth + layout.gap).toBeGreaterThan(610);
  });
  it('uses the top segment for the book in tabletop posture', () => {
    const layout = computeLayout(area, [
      { left: 0, top: 0, width: 1200, height: 400 },
      { left: 0, top: 440, width: 1200, height: 400 },
    ]);
    expect(layout.posture).toBe('tabletop');
    expect(area.top + layout.y + layout.height).toBeLessThanOrEqual(400);
  });
  it('keeps a narrow half-window usable without guessing device identity', () => {
    expect(computeLayout({ ...area, width: 385 }, [{ left: 0, top: 0, width: 385, height: 700 }]).mode).toBe('spread');
  });
  it('does not confuse a narrow spread with a short tabletop segment', () => {
    expect(computeLayout({ ...area, width: 320 }).compact).toBe(false);
    expect(computeLayout({ ...area, height: 190 }).compact).toBe(true);
  });
});
describe('reading position and navigation boundaries', () => {
  it('keeps the same spread across orientation changes', () => {
    expect(visibleStart(3)).toBe(2);
  });
  it.each([
    [0, -1, 0],
    [4, 1, 4],
    [3, 1, 4],
    [4, -1, 2],
  ] as const)('page %i direction %i → %i', (page, direction, result) =>
    expect(nextPage(page, direction, 6)).toBe(result)
  );
});
describe('gesture intentions', () => {
  it('distinguishes slow commitment, short flick and accidental motion', () => {
    expect(shouldCompleteTurn(0.5, 0)).toBe(true);
    expect(shouldCompleteTurn(0.1, 0.7)).toBe(true);
    expect(shouldCompleteTurn(0.03, 4)).toBe(false);
    expect(shouldCompleteTurn(0.2, -0.7)).toBe(false);
  });
  it('does not tear a sticker without sufficient travel', () => {
    expect(peelResult(20, 4)).toBe('attached');
    expect(peelResult(100, 0.2)).toBe('clean');
    expect(peelResult(100, 2)).toBe('residue');
  });
});
