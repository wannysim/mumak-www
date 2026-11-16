import { describe, expect, it } from 'vitest';

import { coverDescription, FACE_LABELS, folioReading, landingAnnouncement } from '../temporary';

describe('temporary copy', () => {
  it('should describe both covers regardless of the angle', () => {
    expect(coverDescription()).toBe(
      '앞표지: 심완, 사진 찍는 개발자. 뒤표지: example@mail.com, instagram.com/example, 사는 곳 · 임시. 화살표 키로 돌려 볼 수 있다.'
    );
  });

  it('should format the landing announcement and the folio reading', () => {
    expect(landingAnnouncement([3, 4])).toBe('03–04쪽');
    expect(landingAnnouncement([5])).toBe('05쪽');
    expect(folioReading([3, 4], 8)).toBe('03–04쪽, 전체 8쪽');
  });

  it('should name every face of the closed book', () => {
    expect(Object.values(FACE_LABELS)).toEqual(['앞표지', '책등', '뒤표지', '책배']);
  });
});
