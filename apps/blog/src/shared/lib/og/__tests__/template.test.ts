import { resolveTitleFontSize } from '../template';

describe('resolveTitleFontSize', () => {
  describe('ko (음절이 넓어 더 빨리 줄인다)', () => {
    it('짧은 제목은 64px을 유지한다', () => {
      expect(resolveTitleFontSize('짧은 제목', 'ko')).toBe(64);
    });

    it('18자 초과는 52px로 줄인다', () => {
      expect(resolveTitleFontSize('열아홉 글자가 넘어가는 제목입니다요', 'ko')).toBe(52);
    });

    it('28자 초과는 44px로 줄인다', () => {
      expect(resolveTitleFontSize('React Compiler가 Rust로, 그리고 코드 대부분은 AI가 썼다', 'ko')).toBe(44);
    });
  });

  describe('en (라틴이 좁아 더 많은 글자를 허용한다)', () => {
    it('짧은 제목은 64px을 유지한다', () => {
      expect(resolveTitleFontSize('A short title', 'en')).toBe(64);
    });

    it('34자 초과는 52px로 줄인다', () => {
      expect(resolveTitleFontSize('A moderately long english blog title', 'en')).toBe(52);
    });

    it('52자 초과는 44px로 줄인다', () => {
      expect(resolveTitleFontSize('An extremely long english blog post title that keeps going', 'en')).toBe(44);
    });
  });

  it('같은 글자 수라도 ko가 en보다 더 작은 폰트를 고른다', () => {
    const sample = 'abcdefghijklmnopqrstuvwxyz'; // 26자
    expect(resolveTitleFontSize(sample, 'ko')).toBeLessThan(resolveTitleFontSize(sample, 'en'));
  });
});
