import { resolveTitleFontSize } from '../template';

describe('resolveTitleFontSize', () => {
  describe('ko (음절이 넓어 더 빨리 줄인다)', () => {
    it('짧은 제목은 64px을 유지한다', () => {
      expect(resolveTitleFontSize('짧은 제목', 'ko')).toBe(64);
    });

    it('26자 초과는 56px로 줄인다', () => {
      expect(resolveTitleFontSize('스물여섯 글자를 확실히 넘어가는 적당히 긴 한국어 제목입니다', 'ko')).toBe(56);
    });

    it('42자 초과는 하한 48px로 줄인다', () => {
      expect(
        resolveTitleFontSize(
          '마흔두 글자를 확실하게 넘어가는 아주 긴 한국어 제목으로 카드 안에 들어가야 하는 케이스입니다',
          'ko'
        )
      ).toBe(48);
    });
  });

  describe('en (라틴이 좁아 더 많은 글자를 허용한다)', () => {
    it('짧은 제목은 64px을 유지한다', () => {
      expect(resolveTitleFontSize('A short title', 'en')).toBe(64);
    });

    it('46자 초과는 56px로 줄인다', () => {
      expect(resolveTitleFontSize('A moderately long english blog post title that fits', 'en')).toBe(56);
    });

    it('70자 초과는 하한 48px로 줄인다', () => {
      expect(
        resolveTitleFontSize('An extremely long english blog post title that just keeps going on and on', 'en')
      ).toBe(48);
    });
  });

  it('폰트는 48px 아래로 내려가지 않는다', () => {
    const veryLong = '가'.repeat(200);
    expect(resolveTitleFontSize(veryLong, 'ko')).toBeGreaterThanOrEqual(48);
    expect(resolveTitleFontSize('a'.repeat(200), 'en')).toBeGreaterThanOrEqual(48);
  });

  it('같은 글자 수라도 ko가 en보다 더 작거나 같은 폰트를 고른다', () => {
    const sample = 'abcdefghijklmnopqrstuvwxyz0123456789'; // 36자
    expect(resolveTitleFontSize(sample, 'ko')).toBeLessThanOrEqual(resolveTitleFontSize(sample, 'en'));
  });
});
