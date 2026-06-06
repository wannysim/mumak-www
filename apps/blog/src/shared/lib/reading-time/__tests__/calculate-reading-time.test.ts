import { calculateReadingTime } from '../calculate-reading-time';

describe('calculateReadingTime', () => {
  it('returns at least 1 minute for short or empty content', () => {
    expect(calculateReadingTime('')).toBe(1);
    expect(calculateReadingTime('짧은 글')).toBe(1);
  });

  it('counts Korean characters at ~500 chars/min', () => {
    const content = '가'.repeat(1000);

    expect(calculateReadingTime(content)).toBe(2);
  });

  it('counts English words at ~200 words/min', () => {
    const content = Array.from({ length: 400 }, () => 'word').join(' ');

    expect(calculateReadingTime(content)).toBe(2);
  });

  it('ignores fenced and inline code', () => {
    const withCode = ['```', 'const x = '.repeat(500), '```', '`inline code here`'].join('\n');

    expect(calculateReadingTime(withCode)).toBe(1);
  });
});
