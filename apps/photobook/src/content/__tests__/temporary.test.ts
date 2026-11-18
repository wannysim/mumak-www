import { describe, expect, it } from 'vitest';

import { closedAnnouncement, coverDescription, folioReading, landingAnnouncement } from '../temporary';

describe('temporary copy', () => {
  it('should describe both covers regardless of the angle', () => {
    expect(coverDescription()).toBe(
      '앞표지: Meoru 그림. 뒤표지: Meoru Butler, x.com/Meoru_butler로 가는 QR 코드. 화살표 키로 돌려 볼 수 있다.'
    );
  });

  it('should format the landing announcement and the folio reading', () => {
    expect(landingAnnouncement([3, 4])).toBe('03–04쪽');
    expect(landingAnnouncement([5])).toBe('05쪽');
    expect(folioReading([3, 4], 8)).toBe('03–04쪽, 전체 8쪽');
  });

  it('should announce which cover the book was closed on', () => {
    expect(closedAnnouncement('front')).toBe('책을 덮었다, 앞표지');
    expect(closedAnnouncement('back')).toBe('책을 덮었다, 뒤표지');
  });
});
