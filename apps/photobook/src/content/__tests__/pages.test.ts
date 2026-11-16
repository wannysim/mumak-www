import { describe, expect, it } from 'vitest';

import { PAGE_COUNT, pageContent, photoSourceOf } from '../pages';

describe('page map', () => {
  it('should hold an opening page, six photo pages and a colophon placeholder', () => {
    expect(PAGE_COUNT).toBe(8);
    expect(pageContent(1)).toMatchObject({ kind: 'opening' });
    expect(pageContent(PAGE_COUNT)).toEqual({ kind: 'colophon', text: '판권면 · 임시' });
    const photos = Array.from({ length: 6 }, (_, index) => pageContent(index + 2));
    expect(photos.every(page => page.kind === 'photo')).toBe(true);
  });

  it('should give every photo a sized source and a non-empty alt text', () => {
    for (let page = 2; page <= 7; page += 1) {
      const content = pageContent(page);
      if (content.kind !== 'photo') {
        throw new Error(`photo expected on page ${page}`);
      }
      expect(content.src).toMatch(/^\/photos\/[a-z]+\.jpg$/);
      expect(content.width).toBeGreaterThan(0);
      expect(content.height).toBeGreaterThan(0);
      expect(content.alt).toMatch(/\(임시 샘플 사진\)$/);
    }
    expect(pageContent(6)).toMatchObject({ src: '/photos/deer.jpg', width: 1200, height: 1981 });
  });

  it('should refuse pages outside the map', () => {
    expect(() => pageContent(0)).toThrow(RangeError);
    expect(() => pageContent(PAGE_COUNT + 1)).toThrow(RangeError);
  });

  it('should return photo sources only for photo pages', () => {
    expect(photoSourceOf(2)).toBe('/photos/forest.jpg');
    expect(photoSourceOf(1)).toBeNull();
  });
});
